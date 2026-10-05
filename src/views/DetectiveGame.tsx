import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Search, Gavel, Send, History, Users, ScrollText, Timer, Lock } from 'lucide-react';
import { saveParticipant } from '../utils/storage';
import { useFocusLock } from '../utils/focusLock';
import { exitFullscreen } from '../utils/fullscreen';
import { soundFX } from '../utils/audio';
import type { Participant } from '../types';

function fmtClock(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
}

export default function DetectiveGame({
  participant,
  onDone,
  onExit,
  readOnly = false,
}: {
  participant: Participant;
  onDone: (p: Participant) => void;
  onExit: () => void;
  readOnly?: boolean;
}) {
  const [story, setStory] = useState<any>(null);
  const [suspect, setSuspect] = useState('vicky');
  const [chats, setChats] = useState<Record<string, { sender: string; text: string }[]>>({});
  const [q, setQ] = useState('');
  const [clues, setClues] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [restored, setRestored] = useState(false);
  const [accuse, setAccuse] = useState({ suspectId: 'vicky', motive: '', explanation: '' });
  const [engine, setEngine] = useState('');
  const [deadline, setDeadline] = useState(() => Date.now() + 45 * 60 * 1000);
  const [now, setNow] = useState(() => Date.now());
  const autoFinished = useRef(false);
  const finishRef = useRef(() => {});
  const focus = useFocusLock(participant.id, !readOnly);
  finishRef.current = () => submitAccusation(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const remaining = Math.max(0, Math.round((deadline - now) / 1000));
  const urgent = remaining < 5 * 60;

  // Block participants from navigating back while event timer is running
  useEffect(() => {
    if (readOnly) return;
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (remaining > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [readOnly, remaining]);

  function leave() {
    if (!readOnly && remaining > 0) return;
    exitFullscreen();
    onExit();
  }

  useEffect(() => {
    if (readOnly) {
      // Sealed round: view-only history, no new session, no timer.
      fetch(`/api/participant/history?participantId=${participant.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.case) setStory(d.case);
          if (d.detective) {
            const slim: Record<string, { sender: string; text: string }[]> = {};
            for (const [k, v] of Object.entries<any>(d.detective.chats || {}))
              slim[k] = (v || []).map((m: any) => ({ sender: m.sender, text: m.text }));
            setChats(slim);
            setClues(d.detective.cluesFound || []);
            if (d.detective.notes) setNotes(d.detective.notes);
          }
        })
        .catch((e) => setErr(String(e)));
      return;
    }
    fetch('/api/detective/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: participant.id }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) {
          setErr(d.error);
          return;
        }
        setStory(d.case);
        setClues(d.cluesFound || []);
        if (d.chats && Object.keys(d.chats).length) {
          const slim: Record<string, { sender: string; text: string }[]> = {};
          for (const [k, v] of Object.entries<any>(d.chats))
            slim[k] = (v || []).map((m: any) => ({ sender: m.sender, text: m.text }));
          setChats(slim);
        }
        if (d.notes) setNotes(d.notes);
        if (d.startedAt && d.roundDurationSec)
          setDeadline(d.startedAt + d.roundDurationSec * 1000);
        const hasHistory =
          (d.cluesFound || []).length > 0 ||
          (d.notes || '').trim() !== '' ||
          Object.values<any>(d.chats || {}).some((v: any) => (v || []).length > 0);
        if (d.resumed && hasHistory) setRestored(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chats, suspect, busy]);

  // 45-minute countdown
  useEffect(() => {
    if (readOnly) return;
    const t = setInterval(() => {
      const tnow = Date.now();
      setNow(tnow);
      if (tnow >= deadline) {
        clearInterval(t);
        finishRef.current();
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  async function ask() {
    const questionText = q.trim();
    if (readOnly || !questionText || busy) return;
    if (Date.now() >= deadline) {
      finishRef.current();
      return;
    }

    // Immediately clear input box and post question to chat window
    setQ('');
    setChats((c) => ({
      ...c,
      [suspect]: [
        ...(c[suspect] || []),
        { sender: 'user', text: questionText },
      ],
    }));
    setBusy(true);
    setErr('');
    soundFX.playClick();

    try {
      const res = await fetch('/api/detective/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: participant.id, suspectId: suspect, message: questionText }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.error === 'TIME_EXPIRED') {
          finishRef.current();
          return;
        }
        throw new Error(d.error);
      }
      if ((d.newClues || []).length) soundFX.playSuccess();
      setChats((c) => ({
        ...c,
        [suspect]: [
          ...(c[suspect] || []),
          { sender: 'ai', text: d.reply },
        ],
      }));
      setClues(d.cluesFound || []);
      if (d.engine) setEngine(d.engine);
    } catch (e: any) {
      soundFX.playFail();
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    await fetch('/api/detective/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: participant.id, notes }),
    });
  }

  async function submitAccusation(auto = false) {
    if (readOnly || autoFinished.current) return;
    autoFinished.current = true;
    exitFullscreen();
    setBusy(true);
    setErr('');
    try {
      await saveNotes();
      const res = await fetch('/api/detective/accuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participant.id,
          suspectId: accuse.suspectId,
          motive: accuse.motive,
          explanation: accuse.explanation,
          evidenceIds: clues,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const updated: Participant = { ...participant, round2Completed: true };
      saveParticipant(updated);
      onDone(updated);
    } catch (e: any) {
      autoFinished.current = false;
      soundFX.playFail();
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!story)
    return (
      <div className="w-full h-screen flex items-center justify-center font-mono text-sm text-[#8e9cb5] animate-fadeIn bg-[#060813]">
        {err ? <span className="text-red-300">{err}</span> : 'Opening case file…'}
      </div>
    );

  const activeSuspect = story.suspects.find((x: any) => x.id === suspect);
  const qCountOf = (id: string) => (chats[id] || []).filter((m) => m.sender === 'user').length;
  const totalQuestions = Object.keys(chats).reduce((a, k) => a + qCountOf(k), 0);
  const suspectsEngaged = Object.keys(chats).filter((k) => (chats[k] || []).length > 0).length;

  return (
    <div className="w-full h-screen max-h-screen flex flex-col p-2 sm:p-3 gap-2 overflow-hidden bg-[#060813] select-none box-border">
      {/* Top Strip - Full width */}
      <div className="shrink-0 bg-[#091122]/90 backdrop-blur-md border border-cyan-500/30 rounded-2xl px-4 py-2 flex items-center justify-between gap-2 flex-wrap shadow-md">
        <div className="flex items-center gap-3">
          {readOnly ? (
            <button
              onClick={() => {
                soundFX.playClick();
                leave();
              }}
              className="font-mono text-xs text-cyan-300/80 hover:text-cyan-200 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> DASHBOARD
            </button>
          ) : (
            <div className="font-mono text-[11px] px-2.5 py-1 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" /> INVESTIGATION ACTIVE
            </div>
          )}
          <span className="font-dossier font-bold text-sm text-white hidden sm:inline">
            {story.caseTitle}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`font-mono text-xs px-2.5 py-0.5 rounded-xl border flex items-center gap-1.5 ${
              urgent
                ? 'bg-red-500/10 border-red-400/60 text-red-300 game-timer-pulse'
                : 'bg-[#040814] border-cyan-500/30 text-cyan-200'
            }`}
          >
            <Timer className="w-3.5 h-3.5 text-cyan-400" /> {fmtClock(remaining)}
          </span>
          {focus.violations > 0 && (
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-xl bg-red-500/10 border border-red-400/50 text-red-300">
              FOCUS ISSUES: {focus.violations}
            </span>
          )}
          <span className="font-mono text-xs px-2.5 py-0.5 rounded-xl bg-[#040814] border border-cyan-500/30 text-[#8e9cb5]">
            ASKED: <b className="text-white">{totalQuestions}</b> · ENGAGED:{' '}
            <b className="text-cyan-300">
              {suspectsEngaged}/{story.suspects.length}
            </b>
          </span>
          <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> CLUES:{' '}
            {clues.length}/{story.clues.length}
          </span>
        </div>
      </div>

      {focus.fsBlocked && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#040814]/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full p-8 rounded-3xl bg-[#091122] border-2 border-amber-200/50 text-center glow-verdict animate-fadeIn">
            <div className="font-mono text-xs text-amber-200 uppercase tracking-widest">Focus lock</div>
            <h2 className="font-display font-black text-2xl mt-2 tracking-wider text-white">
              FULLSCREEN REQUIRED
            </h2>
            <p className="text-xs text-[#8e9cb5] font-mono mt-2 leading-relaxed">
              You left fullscreen during an active round. This break has been reported. Return to
              fullscreen to continue - your timer keeps running.
            </p>
            <button
              onClick={focus.resume}
              className="mt-4 w-full px-6 py-3 rounded-xl font-mono font-bold text-sm btn-prompt-theory cursor-pointer"
            >
              RESUME FULLSCREEN
            </button>
          </div>
        </div>
      )}

      {restored && (
        <div className="shrink-0 font-mono text-[11px] px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 flex items-center gap-1.5 animate-fadeIn">
          <History className="w-3.5 h-3.5" /> Previous interrogations, clues and notes restored from
          the database — continue where you left off.
        </div>
      )}
      {readOnly && (
        <div className="shrink-0 font-mono text-[11px] px-3 py-1.5 rounded-xl bg-[#0b1730] border border-cyan-500/40 text-cyan-200 flex items-center gap-1.5 animate-fadeIn">
          <Gavel className="w-3.5 h-3.5 text-emerald-400" /> CASE SEALED — READ ONLY. Review
          depositions, clues and notes; no new questions.
        </div>
      )}

      {/* 3-Column Main Grid - Fills 100% width and 100% height */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-2.5 overflow-hidden">
        {/* ============ COLUMN 1 — CASE FILE (Full Height) ============ */}
        <div className="xl:col-span-3 rounded-2xl border border-cyan-500/30 bg-[#091122]/90 p-4 flex flex-col h-full min-h-0 overflow-y-auto shadow-lg">
          <div className="font-mono text-xs uppercase tracking-widest text-cyan-300 flex items-center gap-1.5 font-bold">
            <ScrollText className="w-4 h-4 text-cyan-400" /> Case File #2026-VR
          </div>
          <h3 className="font-dossier font-extrabold text-lg mt-2 leading-snug text-white">
            {story.caseTitle}
          </h3>
          <div className="font-type italic text-emerald-300/90 text-sm mt-1.5">
            "At 9:42 PM, the lights went out…"
          </div>

          <div className="mt-3 pt-3 border-t border-cyan-500/20">
            <div className="font-mono text-[11px] uppercase tracking-widest text-cyan-400 font-semibold">
              Victim
            </div>
            <p className="text-sm text-[#e2e8f0] mt-1 leading-relaxed">{story.victim}</p>
          </div>

          <div className="mt-3 pt-3 border-t border-cyan-500/20">
            <div className="font-mono text-[11px] uppercase tracking-widest text-cyan-400 font-semibold">
              Brief
            </div>
            <p className="text-xs text-[#8e9cb5] mt-1 leading-relaxed">{story.storyText}</p>
          </div>

          <div className="mt-auto pt-3 border-t border-cyan-500/20">
            <div className="font-mono text-[11px] uppercase tracking-widest text-cyan-400 font-semibold">
              Detective Protocol
            </div>
            <ul className="text-[11px] text-[#8e9cb5] mt-1.5 space-y-1 font-mono leading-relaxed list-disc ml-4">
              <li>Pick a suspect, ask sharp questions.</li>
              <li>Evasive answers hide clues — confront contradictions.</li>
              <li>One charge-sheet. Make it count.</li>
            </ul>
          </div>
        </div>

        {/* ============ COLUMN 2 — CHAT (Suspects List + Chat Window) ============ */}
        <div className="xl:col-span-6 rounded-2xl border border-cyan-500/30 bg-[#091122]/90 overflow-hidden flex flex-col h-full min-h-0 shadow-2xl">
          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
            {/* Inner Left — Suspects List */}
            <div className="md:w-52 shrink-0 border-b md:border-b-0 md:border-r border-cyan-500/20 bg-[#040814]/80 p-2.5 flex flex-col overflow-y-auto gap-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-300 font-bold flex items-center gap-1.5 px-1 pb-1">
                <Users className="w-3.5 h-3.5 text-cyan-400" /> Persons of Interest
              </div>
              <div className="flex md:flex-col flex-row overflow-x-auto gap-1.5 flex-1">
                {story.suspects.map((s: any) => {
                  const n = qCountOf(s.id);
                  const active = suspect === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        soundFX.playClick();
                        setSuspect(s.id);
                      }}
                      className={`min-w-[180px] md:min-w-0 text-left p-2.5 rounded-xl border transition-all flex items-center gap-2.5 cursor-pointer ${
                        active
                          ? 'border-emerald-400/60 bg-emerald-500/15 glow-live text-white'
                          : 'border-cyan-500/20 bg-[#091122]/70 hover:border-cyan-400/50 text-[#8e9cb5]'
                      }`}
                    >
                      <span
                        className={`w-9 h-9 rounded-lg border flex items-center justify-center font-dossier font-black text-base shrink-0 ${
                          active
                            ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                            : 'border-cyan-500/30 bg-[#10192e] text-cyan-300'
                        }`}
                      >
                        {s.name?.[0]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-dossier font-bold text-xs truncate text-white">
                          {s.name}
                        </span>
                        <span className="block font-mono text-[10px] text-[#8e9cb5] truncate">
                          {s.role}
                        </span>
                        <span
                          className={`inline-block mt-0.5 font-mono text-[9px] px-1.5 py-0.2 rounded-full border ${
                            n > 0
                              ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-300'
                              : 'bg-[#040814] border-cyan-500/20 text-[#52637a]'
                          }`}
                        >
                          {n} question{n === 1 ? '' : 's'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inner Right — Chat Window */}
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
              <div className="bg-[#040814]/90 px-3.5 py-2 border-b border-cyan-500/20 flex items-center justify-between gap-2 flex-wrap shrink-0">
                <span className="font-dossier font-bold text-sm text-white">
                  {activeSuspect?.name}{' '}
                  <span className="font-mono text-xs font-normal text-cyan-300/70">
                    · {activeSuspect?.role}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {engine === 'simulation' && (
                    <span
                      className="font-mono text-[10px] text-amber-200/90"
                      title="Your Ollama key isn't answering — local stand-in active."
                    >
                      ⚠ local stand-in
                    </span>
                  )}
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 flex items-center gap-1 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> REC ·{' '}
                    {qCountOf(suspect)}
                  </span>
                </span>
              </div>

              {/* Chat Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-2.5 min-h-0">
                {(chats[suspect] || []).map((m, i) => (
                  <div
                    key={i}
                    className={`max-w-[90%] p-3 rounded-2xl text-xs sm:text-sm leading-relaxed animate-fadeIn ${
                      m.sender === 'user'
                        ? 'ml-auto bg-cyan-950/40 border border-cyan-400/40 rounded-tr-sm text-cyan-50'
                        : 'mr-auto bg-[#040814] border border-cyan-500/20 rounded-tl-sm text-[#d9d2f2]'
                    }`}
                  >
                    <div className="font-mono text-[9px] uppercase tracking-widest mb-1 opacity-60">
                      {m.sender === 'user' ? '◆ Detective (you)' : `◇ ${activeSuspect?.name}`}
                    </div>
                    {m.text}
                  </div>
                ))}
                {!(chats[suspect] || []).length && !busy && (
                  <div className="text-[#52637a] text-xs font-mono text-center pt-24">
                    — ask your first question to {activeSuspect?.name} —
                  </div>
                )}
                {busy && (
                  <div className="max-w-[90%] mr-auto bg-[#040814] border border-cyan-500/20 rounded-2xl rounded-tl-sm px-4 py-2.5 animate-fadeIn">
                    <div className="font-mono text-[10px] uppercase tracking-widest mb-1 opacity-60 text-cyan-300">
                      ◇ {activeSuspect?.name} is responding
                    </div>
                    <span className="typing-dots">
                      <span className="typing-dot bg-emerald-400" />
                      <span className="typing-dot bg-emerald-400" />
                      <span className="typing-dot bg-emerald-400" />
                    </span>
                  </div>
                )}
              </div>

              {/* Interrogation Input */}
              <div
                className="p-2.5 border-t border-cyan-500/20 flex gap-2 bg-[#040814]/60 shrink-0"
                style={{ display: readOnly ? 'none' : undefined }}
              >
                <input
                  className="flex-1 px-3 py-2 rounded-xl bg-[#040814] border border-cyan-500/30 text-xs sm:text-sm font-sans focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 outline-none placeholder:text-[#52637a] text-[#ece9f7]"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && ask()}
                  placeholder={`Interrogate ${activeSuspect?.name}... (where? alibi? motive?)`}
                />
                <button
                  onClick={ask}
                  disabled={busy}
                  className="px-4 rounded-xl btn-prompt-theory font-mono font-bold text-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> ASK
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ============ COLUMN 3 — EVIDENCE (Upper) + NOTES & ACCUSATION (Lower) ============ */}
        <div className="xl:col-span-3 flex flex-col h-full min-h-0 gap-2.5 overflow-hidden">
          {/* Evidence Vault */}
          <div className="rounded-2xl border border-cyan-500/30 bg-[#091122]/90 p-3 flex flex-col overflow-hidden shrink-0 max-h-[35%] shadow-lg">
            <div className="inline-flex px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-400/30 font-mono text-[11px] text-cyan-300 font-bold">
              ⚡ Evidence Vault ({clues.length}/{story.clues.length})
            </div>
            <ul className="mt-2 space-y-1.5 overflow-y-auto pr-1 flex-1">
              {story.clues.map((c: any, i: number) => {
                const found = clues.includes(c.id);
                return (
                  <li
                    key={c.id}
                    className={`p-2 rounded-xl border text-[11px] ${
                      found
                        ? 'border-emerald-400/40 bg-emerald-500/10 text-white'
                        : 'border-cyan-500/20 bg-[#040814]/50 opacity-60 text-[#64748b]'
                    }`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span
                        className={`font-mono text-[9px] px-2 py-0.2 rounded-full border ${
                          found
                            ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 font-bold'
                            : 'bg-[#10192e] border-cyan-500/20 text-[#64748b]'
                        }`}
                      >
                        {found ? `✓ CLUE #${i + 1}` : `CLUE #${i + 1}`}
                      </span>
                      {!found && <span className="font-mono text-[9px] text-[#52637a]">sealed</span>}
                    </div>
                    <div className={`font-bold mt-0.5 ${found ? 'text-white' : 'text-[#52637a]'}`}>
                      {found ? c.title : '??? — interrogate to uncover'}
                    </div>
                    {found && <div className="text-[#8e9cb5] text-[10px] mt-0.5">{c.description}</div>}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Detective Notes & Final Accusation */}
          <div className="flex-1 min-h-0 rounded-2xl border border-cyan-500/30 bg-[#091122]/90 p-3 flex flex-col overflow-y-auto gap-2 shadow-lg">
            <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-300 font-bold">
              Detective Notes
            </div>
            <textarea
              rows={3}
              className="w-full p-2.5 rounded-xl bg-[#040814] border border-cyan-500/20 font-mono text-xs focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 outline-none placeholder:text-[#52637a] text-[#ece9f7] resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              disabled={readOnly}
              placeholder="Who had a motive? Who benefits? Where was everyone at 9:42?"
            />

            {/* Final Accusation */}
            <div
              className="rounded-xl border border-amber-300/30 bg-[#040814]/80 p-2.5 mt-auto"
              style={{ display: readOnly ? 'none' : undefined }}
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-amber-200 flex items-center gap-1.5 font-bold">
                <Gavel className="w-3.5 h-3.5" /> Final Accusation — One Chance
              </div>
              <select
                className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg bg-[#091122] border border-amber-300/30 text-xs focus:border-amber-200 outline-none text-[#ece9f7]"
                value={accuse.suspectId}
                onChange={(e) => setAccuse({ ...accuse, suspectId: e.target.value })}
              >
                {story.suspects.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.role}
                  </option>
                ))}
              </select>
              <input
                className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg bg-[#091122] border border-amber-300/30 text-xs focus:border-amber-200 outline-none placeholder:text-[#52637a] text-[#ece9f7]"
                placeholder="Why would they do it?"
                value={accuse.motive}
                onChange={(e) => setAccuse({ ...accuse, motive: e.target.value })}
              />
              <input
                className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg bg-[#091122] border border-amber-300/30 text-xs focus:border-amber-200 outline-none placeholder:text-[#52637a] text-[#ece9f7]"
                placeholder="What happened, step by step..."
                value={accuse.explanation}
                onChange={(e) => setAccuse({ ...accuse, explanation: e.target.value })}
              />

              {err && (
                <div className="text-red-300 text-[10px] font-mono bg-red-950/70 border border-red-400/50 rounded-lg px-2 py-1 mt-1.5 animate-fadeIn">
                  {err}
                </div>
              )}

              <button
                onClick={() => submitAccusation(false)}
                disabled={busy}
                className="mt-2 w-full py-2.5 rounded-xl font-mono font-bold text-xs uppercase bg-gradient-to-r from-amber-400 to-yellow-300 text-black hover:brightness-110 disabled:opacity-50 glow-verdict cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" /> Submit Solution &amp; Finish
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
