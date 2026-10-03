import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Search, FileText, Gavel, Send, Shield, History, Users, ScrollText, Timer } from 'lucide-react';
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

export default function DetectiveGame({ participant, onDone, onExit, readOnly = false }: { participant: Participant; onDone: (p: Participant) => void; onExit: () => void; readOnly?: boolean }) {
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

  useEffect(() => {
    if (readOnly) {
      // Sealed round: view-only history, no new session, no timer.
      fetch(`/api/participant/history?participantId=${participant.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.case) setStory(d.case);
          if (d.detective) {
            const slim: Record<string, { sender: string; text: string }[]> = {};
            for (const [k, v] of Object.entries<any>(d.detective.chats || {})) slim[k] = (v || []).map((m: any) => ({ sender: m.sender, text: m.text }));
            setChats(slim);
            setClues(d.detective.cluesFound || []);
            if (d.detective.notes) setNotes(d.detective.notes);
          }
        })
        .catch((e) => setErr(String(e)));
      return;
    }
    fetch('/api/detective/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantId: participant.id }) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) { setErr(d.error); return; }
        setStory(d.case);
        setClues(d.cluesFound || []);
        if (d.chats && Object.keys(d.chats).length) {
          const slim: Record<string, { sender: string; text: string }[]> = {};
          for (const [k, v] of Object.entries<any>(d.chats)) slim[k] = (v || []).map((m: any) => ({ sender: m.sender, text: m.text }));
          setChats(slim);
        }
        if (d.notes) setNotes(d.notes);
        if (d.startedAt && d.roundDurationSec) setDeadline(d.startedAt + d.roundDurationSec * 1000);
        const hasHistory = (d.cluesFound || []).length > 0 || (d.notes || '').trim() !== '' || Object.values<any>(d.chats || {}).some((v: any) => (v || []).length > 0);
        if (d.resumed && hasHistory) setRestored(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [chats, suspect, busy]);

  // 45-minute countdown - auto-submits the charge-sheet at zero (live rounds only).
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

  function leave() {
    exitFullscreen();
    onExit();
  }

  async function ask() {
    if (readOnly || !q.trim() || busy) return;
    if (Date.now() >= deadline) { finishRef.current(); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/detective/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantId: participant.id, suspectId: suspect, message: q }) });
      const d = await res.json();
      if (!res.ok) {
        if (d.error === 'TIME_EXPIRED') { finishRef.current(); return; }
        throw new Error(d.error);
      }
      soundFX.playClick();
      if ((d.newClues || []).length) soundFX.playSuccess();
      setChats((c) => ({ ...c, [suspect]: [...(c[suspect] || []), { sender: 'user', text: q }, { sender: 'ai', text: d.reply }] }));
      setClues(d.cluesFound || []);
      if (d.engine) setEngine(d.engine);
      setQ('');
    } catch (e: any) { soundFX.playFail(); setErr(e.message); }
    finally { setBusy(false); }
  }

  async function saveNotes() {
    await fetch('/api/detective/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantId: participant.id, notes }) });
  }

  async function submitAccusation(auto = false) {
    if (readOnly || autoFinished.current) return;
    autoFinished.current = true;
    exitFullscreen();
    setBusy(true); setErr('');
    try {
      await saveNotes();
      const res = await fetch('/api/detective/accuse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantId: participant.id, suspectId: accuse.suspectId, motive: accuse.motive, explanation: accuse.explanation, evidenceIds: clues }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const updated: Participant = { ...participant, round2Completed: true };
      saveParticipant(updated);
      onDone(updated);
    } catch (e: any) { autoFinished.current = false; soundFX.playFail(); setErr(e.message); }
    finally { setBusy(false); }
  }

  const remaining = Math.max(0, Math.round((deadline - now) / 1000));
  const urgent = remaining < 5 * 60;

  if (!story) return <div className="p-6 text-center font-mono text-sm text-[#8f86ad] animate-fadeIn">{err ? <span className="text-red-300">{err}</span> : 'Opening case file…'}</div>;

  const activeSuspect = story.suspects.find((x: any) => x.id === suspect);
  const qCountOf = (id: string) => (chats[id] || []).filter((m) => m.sender === 'user').length;
  const totalQuestions = Object.keys(chats).reduce((a, k) => a + qCountOf(k), 0);
  const suspectsEngaged = Object.keys(chats).filter((k) => (chats[k] || []).length > 0).length;

  return (
    <div className="w-full px-3 sm:px-5 mt-6 animate-fadeIn select-none">
      {/* top strip */}
      <div className="bg-[#0a0614]/95 backdrop-blur-md border border-[#4a3670]/60 rounded-2xl px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => { soundFX.playClick(); leave(); }} className="font-mono text-[11px] text-[#8f86ad] hover:text-white flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> BASE
          </button>
          <span className="font-dossier font-bold text-sm hidden sm:inline">{story.caseTitle}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-mono text-[11px] px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${urgent ? 'bg-red-500/10 border-red-400/60 text-red-300 game-timer-pulse' : 'bg-[#1d1440] border-[#4a3670]/60 text-[#d9d2f2]'}`}>
            <Timer className="w-3.5 h-3.5" /> {fmtClock(remaining)}
          </span>
          {focus.violations > 0 && <span className="font-mono text-[11px] px-2.5 py-1 rounded-xl bg-red-500/10 border border-red-400/50 text-red-300">FOCUS ISSUES: {focus.violations}</span>}
          <span className="font-mono text-[11px] px-2.5 py-1 rounded-xl bg-[#1d1440] border border-[#4a3670]/60 text-[#d9d2f2]">
            ASKED: {totalQuestions} · ENGAGED: {suspectsEngaged}/{story.suspects.length}
          </span>
          <span className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> CLUES: {clues.length}/{story.clues.length}
          </span>
        </div>
      </div>

      {focus.fsBlocked && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#0a0614]/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full p-8 rounded-3xl panel-tribunal border-2 border-amber-200/50 text-center glow-verdict animate-fadeIn">
            <div className="label-gold">Focus lock</div>
            <h2 className="font-display font-black text-2xl mt-2 tracking-wider">FULLSCREEN REQUIRED</h2>
            <p className="text-xs text-[#8f86ad] font-mono mt-2 leading-relaxed">You left fullscreen during an active round. This break has been reported. Return to fullscreen to continue - your timer keeps running.</p>
            <button onClick={focus.resume} className="mt-4 w-full px-6 py-3 rounded-xl font-mono font-bold text-sm btn-tribunal">RESUME FULLSCREEN</button>
          </div>
        </div>
      )}

      {restored && (
        <div className="mt-2 font-mono text-[11px] px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 flex items-center gap-1.5 animate-fadeIn">
          <History className="w-3.5 h-3.5" /> Previous interrogations, clues and notes restored from the database — continue where you left off.
        </div>
      )}

      {focus.fsBlocked && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#0a0614]/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full p-8 rounded-3xl panel-tribunal border-2 border-amber-200/50 text-center glow-verdict animate-fadeIn">
            <div className="label-gold">Focus lock</div>
            <h2 className="font-display font-black text-2xl mt-2 tracking-wider">FULLSCREEN REQUIRED</h2>
            <p className="text-xs text-[#8f86ad] font-mono mt-2 leading-relaxed">You left fullscreen during an active round. This break has been reported. Return to fullscreen to continue - your timer keeps running.</p>
            <button onClick={focus.resume} className="mt-4 w-full px-6 py-3 rounded-xl font-mono font-bold text-sm btn-tribunal">RESUME FULLSCREEN</button>
          </div>
        </div>
      )}
      {readOnly && (
        <div className="mt-2 font-mono text-[11px] px-3 py-2 rounded-xl bg-[#1d1440] border border-[#6b4fa8]/60 text-amber-200 flex items-center gap-1.5 animate-fadeIn">
          <Gavel className="w-3.5 h-3.5" /> CASE SEALED — READ ONLY. Review depositions, clues and notes; no new questions.
        </div>
      )}
      <div className="grid xl:grid-cols-12 gap-3 mt-3 items-start">
        {/* ============ COLUMN 1 — CASE FILE ============ */}
        <div className="xl:col-span-3 rounded-2xl border border-[#4a3670]/60 bg-[#150e28]/70 p-5">
          <div className="label-gold flex items-center gap-1.5">
            <ScrollText className="w-4 h-4" /> Case File #2026-VR
          </div>
          <h3 className="font-dossier font-extrabold text-lg mt-2 leading-snug">{story.caseTitle}</h3>
          <div className="font-type italic text-emerald-300/80 text-sm mt-2">"At 9:42 PM, the lights went out…"</div>
          <div className="mt-3 pt-3 border-t border-[#4a3670]/50">
            <div className="font-mono text-[11px] uppercase tracking-widest text-[#8f86ad]">Victim</div>
            <p className="text-sm text-[#cfc8ea] mt-1 leading-relaxed">{story.victim}</p>
          </div>
          <div className="mt-3 pt-3 border-t border-[#4a3670]/50">
            <div className="font-mono text-[11px] uppercase tracking-widest text-[#8f86ad]">Brief</div>
            <p className="text-sm text-[#8f86ad] mt-1 leading-relaxed">{story.storyText}</p>
          </div>
          <div className="mt-3 pt-3 border-t border-[#4a3670]/50">
            <div className="font-mono text-[11px] uppercase tracking-widest text-[#8f86ad]">Detective Protocol</div>
            <ul className="text-[11px] text-[#8f86ad] mt-1.5 space-y-1.5 font-mono leading-relaxed list-disc ml-4">
              <li>Pick a suspect, ask sharp questions.</li>
              <li>Evasive answers hide clues — press specifics, confront contradictions.</li>
              <li>One charge-sheet. Make it count.</li>
            </ul>
          </div>
        </div>

        {/* ============ COLUMN 2 — CHAT (characters | window) ============ */}
        <div className="xl:col-span-6 rounded-2xl border border-[#4a3670]/60 bg-[#150e28]/60 overflow-hidden">
          <div className="grid md:grid-cols-12 min-h-[600px]">
            {/* inner left — characters list */}
            <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-[#4a3670]/50 bg-[#0a0614]/60 p-3 flex flex-col">
              <div className="font-mono text-[11px] uppercase tracking-widest text-[#8f86ad] flex items-center gap-1.5 px-1 pb-2">
                <Users className="w-4 h-4" /> Persons of Interest
              </div>
              <div className="flex md:flex-col flex-row overflow-x-auto gap-2">
                {story.suspects.map((s: any) => {
                  const n = qCountOf(s.id);
                  const active = suspect === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => { soundFX.playClick(); setSuspect(s.id); }}
                      className={`min-w-[210px] md:min-w-0 text-left p-3 rounded-2xl border transition-all flex items-center gap-3 ${active ? 'border-emerald-400/60 bg-emerald-500/10 glow-live' : 'border-[#4a3670]/50 bg-[#150e28]/70 hover:border-[#6b4fa8]'}`}
                    >
                      <span className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center font-dossier font-black text-lg shrink-0 ${active ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-300' : 'border-[#4a3670]/70 bg-[#1d1440] text-[#8f86ad]'}`}>
                        {s.name?.[0]}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-dossier font-bold text-sm truncate">{s.name}</span>
                        <span className="block font-mono text-[10px] text-[#8f86ad] truncate">{s.role}</span>
                        <span className={`inline-block mt-1 font-mono text-[10px] px-2 py-0.5 rounded-full border ${n > 0 ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-300' : 'bg-[#0a0614] border-[#4a3670]/60 text-[#5f5585]'}`}>
                          {n} question{n === 1 ? '' : 's'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="font-mono text-[10px] text-[#5f5585] mt-2 px-1 leading-relaxed hidden md:block">Switch subjects freely — every deposition is recorded separately.</p>
            </div>
            {/* inner right — actual chat window */}
            <div className="md:col-span-8 flex flex-col min-h-[480px]">
              <div className="bg-[#0a0614]/80 px-4 py-2.5 border-b border-[#4a3670]/50 flex items-center justify-between gap-2 flex-wrap">
                <span className="font-dossier font-bold text-sm">{activeSuspect?.name} <span className="font-mono text-[10px] font-normal text-[#8f86ad]">· {activeSuspect?.role}</span></span>
                <span className="flex items-center gap-2">
                  {engine === 'simulation' && <span className="font-mono text-[10px] text-amber-200/90" title="Your Ollama key isn't answering — local stand-in active. Re-check your key.">⚠ local stand-in</span>}
                  <span className="font-mono text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> REC · {qCountOf(suspect)}
                  </span>
                </span>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[340px] max-h-[52vh]">
                {(chats[suspect] || []).map((m, i) => (
                  <div key={i} className={`max-w-[90%] p-3.5 rounded-2xl text-sm leading-relaxed animate-fadeIn ${m.sender === 'user' ? 'ml-auto bg-amber-300/10 border border-amber-200/30 rounded-tr-sm text-amber-100' : 'mr-auto bg-[#0a0614] border border-[#4a3670]/60 rounded-tl-sm text-[#d9d2f2]'}`}>
                    <div className="font-mono text-[10px] uppercase tracking-widest mb-1 opacity-60">{m.sender === 'user' ? '◆ Detective (you)' : `◇ ${activeSuspect?.name}`}</div>
                    {m.text}
                  </div>
                ))}
                {!(chats[suspect] || []).length && !busy && <div className="text-[#5f5585] text-xs font-mono text-center pt-16">— ask your first question —</div>}
                {busy && (
                  <div className="max-w-[90%] mr-auto bg-[#0a0614] border border-[#4a3670]/60 rounded-2xl rounded-tl-sm px-4 py-3 animate-fadeIn">
                    <div className="font-mono text-[10px] uppercase tracking-widest mb-1 opacity-60">◇ {activeSuspect?.name} is responding</div>
                    <span className="typing-dots"><span className="typing-dot typing-dot-emerald" /><span className="typing-dot typing-dot-emerald" /><span className="typing-dot typing-dot-emerald" /></span>
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-[#4a3670]/50 flex gap-2 bg-[#0a0614]/40" style={{ display: readOnly ? 'none' : undefined }}>
                <input
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[#0a0614]/80 border border-[#4a3670]/70 text-sm font-sans focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40 outline-none placeholder:text-[#5f5585] text-[#ece9f7]"
                  value={q} onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && ask()}
                  placeholder={`Interrogate ${activeSuspect?.name}… (breaker? bribe? debt? alibi?)`}
                />
                <button onClick={ask} disabled={busy} className="px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#06110c] font-mono font-bold text-xs disabled:opacity-50 flex items-center gap-1.5 glow-live">
                  <Send className="w-4 h-4" /> ASK
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ============ COLUMN 3 — EVIDENCE (upper) + NOTES (lower) ============ */}
        <div className="xl:col-span-3 flex flex-col gap-3">
          <div className="rounded-2xl border border-[#4a3670]/60 bg-[#150e28]/80 p-4">
            <div className="inline-flex px-3 py-1 rounded-full bg-amber-300/10 border border-amber-200/30 label-gold">
              ⚡ Evidence Vault ({clues.length}/{story.clues.length})
            </div>
            <ul className="mt-3 space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {story.clues.map((c: any, i: number) => {
                const found = clues.includes(c.id);
                return (
                  <li key={c.id} className={`p-3 rounded-xl border text-xs ${found ? 'border-emerald-400/40 bg-emerald-500/5' : 'border-[#4a3670]/50 bg-[#0a0614]/50 opacity-70'}`}>
                    <div className="flex justify-between items-center gap-2">
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full border ${found ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300' : 'bg-[#241a45] border-[#4a3670] text-[#8f86ad]'}`}>
                        {found ? `✓ CLUE #${i + 1}` : `CLUE #${i + 1}`}
                      </span>
                      {!found && <span className="font-mono text-[10px] text-[#5f5585]">sealed</span>}
                    </div>
                    <div className={`font-bold mt-1 ${found ? 'text-white' : 'text-[#5f5585]'}`}>{found ? c.title : '??? — interrogate to uncover'}</div>
                    {found && <div className="text-[#8f86ad] mt-0.5">{c.description}</div>}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="rounded-2xl border border-[#4a3670]/60 bg-[#150e28]/60 p-4">
            <div className="font-mono text-[11px] uppercase tracking-widest text-[#8f86ad]">Detective Notes</div>
            <textarea
              rows={5}
              className="mt-2 w-full p-3 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 font-mono text-xs focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40 outline-none placeholder:text-[#5f5585] text-[#ece9f7]"
              value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} disabled={readOnly}
              placeholder="Link Perumal→breaker 9:42, Rs.10L bribe, Vicky Rs.85L debt + deed, Rangan CCTV alibi…"
            />
            <div className="mt-3 rounded-2xl border border-[#4a3670]/60 bg-[#0a0614]/60 p-4" style={{ display: readOnly ? 'none' : undefined }}>
              <div className="font-mono text-[11px] uppercase tracking-widest text-amber-200 flex items-center gap-1.5"><Gavel className="w-4 h-4" /> Final Accusation — one chance</div>
              <select className="mt-2 w-full px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-sm focus:border-amber-200 outline-none text-[#ece9f7]" value={accuse.suspectId} onChange={(e) => setAccuse({ ...accuse, suspectId: e.target.value })}>
                {story.suspects.map((s: any) => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
              </select>
              <input className="mt-2 w-full px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-sm focus:border-amber-200 outline-none placeholder:text-[#5f5585] text-[#ece9f7]" placeholder="Motive (debt / settlement deed…)" value={accuse.motive} onChange={(e) => setAccuse({ ...accuse, motive: e.target.value })} />
              <input className="mt-2 w-full px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-sm focus:border-amber-200 outline-none placeholder:text-[#5f5585] text-[#ece9f7]" placeholder="Explanation (blackout / breaker / study…)" value={accuse.explanation} onChange={(e) => setAccuse({ ...accuse, explanation: e.target.value })} />
            </div>
          </div>
        </div>
      </div>

      {err && <div className="text-red-300 text-xs font-mono bg-red-950/70 border border-red-400/50 rounded-xl px-3 py-2 mt-3 animate-fadeIn">{err}</div>}
      <button onClick={() => submitAccusation(false)} disabled={busy} style={{ display: readOnly ? 'none' : undefined }} className="mt-3 w-full px-6 py-3.5 rounded-2xl font-mono font-black text-sm uppercase bg-gradient-to-r from-amber-300 to-yellow-200 text-[#241a05] hover:brightness-110 disabled:opacity-50 glow-verdict">
        <Search className="w-4 h-4 inline mr-1" /> Submit Solution &amp; Finish
      </button>
    </div>
  );
}
