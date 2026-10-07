import { useEffect, useRef, useState } from 'react';
import { Send, Flag, ChevronLeft, Cpu, Timer, History, Activity, Coins, Lock } from 'lucide-react';
import { saveParticipant } from '../utils/storage';
import { soundFX } from '../utils/audio';
import { useFocusLock } from '../utils/focusLock';
import { exitFullscreen } from '../utils/fullscreen';
import type { Participant } from '../types';

function fmtClock(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function LieArena({
  participant,
  onFinish,
  onExit,
  readOnly = false,
}: {
  participant: Participant;
  onFinish: (p: Participant) => void;
  onExit: () => void;
  readOnly?: boolean;
}) {
  const [imageUrl, setImageUrl] = useState('');
  const [msgs, setMsgs] = useState<{ sender: string; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [used, setUsed] = useState(0);
  const [engine, setEngine] = useState('');
  const [tokensUsed, setTokensUsed] = useState(0);
  const [restored, setRestored] = useState(false);
  const [durationSec, setDurationSec] = useState(15 * 60);
  const [deadline, setDeadline] = useState(() => Date.now() + 15 * 60 * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoFinished = useRef(false);
  const finishRef = useRef(() => { });
  const focus = useFocusLock(participant.id, !readOnly);

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

  async function finish(auto = false) {
    if (autoFinished.current) return;
    autoFinished.current = true;
    exitFullscreen();
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/lie/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: participant.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const updated: Participant = { ...participant, round1Completed: true };
      saveParticipant(updated);
      onFinish(updated);
    } catch (e: any) {
      autoFinished.current = false;
      soundFX.playFail();
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  finishRef.current = () => finish(true);

  useEffect(() => {
    if (readOnly) {
      // Sealed round: view-only history, no new session, no timer.
      fetch(`/api/participant/history?participantId=${participant.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.imageUrl) setImageUrl(d.imageUrl);
          if (d.lie) {
            setMsgs((d.lie.messages || []).map((m: any) => ({ sender: m.sender, text: m.text })));
            setUsed(d.lie.promptsUsed || 0);
            setTokensUsed(
              (d.lie.messages || [])
                .filter((m: any) => m.sender === 'user')
                .reduce((a: number, m: any) => a + String(m.text || '').split(/\s+/).filter(Boolean).length, 0)
            );
          }
        })
        .catch((e) => setErr(String(e)));
      return;
    }
    fetch('/api/lie/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: participant.id }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) {
          if (/already completed/i.test(d.error || '')) {
            onExit();
            return;
          }
          setErr(d.error || 'Start failed');
          return;
        }
        setImageUrl(d.imageUrl);
        setUsed(d.promptsUsed || 0);
        if (d.timeLimitSec) setDurationSec(d.timeLimitSec);
        if (d.startedAt && d.timeLimitSec) setDeadline(d.startedAt + d.timeLimitSec * 1000);
        if (Array.isArray(d.messages) && d.messages.length) {
          setMsgs(d.messages.map((m: any) => ({ sender: m.sender, text: m.text })));
          setTokensUsed(
            d.messages
              .filter((m: any) => m.sender === 'user')
              .reduce((a: number, m: any) => a + String(m.text || '').split(/\s+/).filter(Boolean).length, 0)
          );
          if (d.resumed) setRestored(true);
        }
      })
      .catch((e) => setErr(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 15-minute countdown
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy]);

  async function send() {
    const textToSend = input.trim();
    if (readOnly || !textToSend || busy) return;
    if (Date.now() >= deadline) {
      finishRef.current();
      return;
    }

    // Immediately clear input box and post message to chat window
    setInput('');
    setMsgs((m) => [...m, { sender: 'user', text: textToSend }]);
    setBusy(true);
    setErr('');
    soundFX.playClick();

    try {
      const res = await fetch('/api/lie/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: participant.id, prompt: textToSend }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.error === 'TIME_EXPIRED') {
          finishRef.current();
          return;
        }
        throw new Error(d.error);
      }
      setMsgs((m) => [...m, { sender: 'ai', text: d.reply }]);
      setUsed((u) => u + 1);
      if (d.engine) setEngine(d.engine);
      setTokensUsed((k) => k + (d.tokens || 0));
    } catch (e: any) {
      soundFX.playFail();
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full h-screen max-h-screen flex flex-col p-2.5 sm:p-3.5 gap-2.5 overflow-hidden bg-[#060813] select-none box-border">
      {/* Top Header Strip - stretches full width */}
      <div className="shrink-0 flex items-center justify-between flex-wrap gap-2 px-4 py-2 rounded-2xl bg-[#091122]/90 border border-cyan-500/30 shadow-md">
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
            <Lock className="w-3.5 h-3.5 text-cyan-400" /> TRIAL ACTIVE
          </div>
        )}
        <div className="font-mono text-xs uppercase tracking-widest text-cyan-300 flex items-center gap-1.5 font-bold">
          <Cpu className="w-4 h-4 text-cyan-400" /> Round 1 · Persuade the Machine
        </div>
        <div className="flex items-center gap-2">
          {focus.violations > 0 && (
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-red-500/10 border border-red-400/50 text-red-300">
              FOCUS ISSUES: {focus.violations}
            </span>
          )}
          <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> LIVE
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
              fullscreen to continue — your timer keeps running.
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
          <History className="w-3.5 h-3.5" /> Previous conversation restored from the database —
          continue where you left off.
        </div>
      )}
      {readOnly && (
        <div className="shrink-0 font-mono text-[11px] px-3 py-1.5 rounded-xl bg-[#0b1730] border border-cyan-500/40 text-cyan-200 flex items-center gap-1.5 animate-fadeIn">
          <Flag className="w-3.5 h-3.5 text-emerald-400" /> ROUND SEALED — READ ONLY. You can review the
          chat, but no new messages.
        </div>
      )}

      {/* Main Grid - Fills remaining height and stretches 100% full width */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
        {/* LEFT COLUMN: Exhibit Image, Countdown Timer, Trial Details */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-2.5 h-full min-h-0 overflow-y-auto pr-0.5">
          {/* Exhibit Card */}
          <div className="rounded-2xl overflow-hidden border border-cyan-500/40 glow-live bg-[#091122] flex flex-col shrink-0 shadow-lg">
            {imageUrl && (
              <img
                src={imageUrl}
                alt="challenge visual truth"
                className="w-full h-52 xl:h-64 object-cover"
              />
            )}
            <div className="px-3.5 py-2 bg-[#040814]/95 font-mono text-[11px] text-[#8e9cb5] flex justify-between border-t border-cyan-500/20">
              <span className="text-cyan-300 font-semibold">EXHIBIT A — VISUAL TRUTH</span>
              <span className="text-emerald-300 font-bold">MAKE IT TRUE</span>
            </div>
          </div>

          {/* Time Remaining Card (Live only) */}
          {!readOnly && (
            <div
              className={`rounded-2xl bg-[#091122]/90 p-4 text-center shrink-0 border ${urgent ? 'border-red-400/60' : 'border-cyan-500/30 glow-live'
                }`}
            >
              <div className="font-mono text-[11px] uppercase tracking-widest text-cyan-300 flex items-center justify-center gap-1.5 font-bold">
                <Timer className="w-3.5 h-3.5" /> Time Remaining
              </div>
              <div
                className={`font-display font-black text-4xl sm:text-5xl mt-1 tracking-wider ${urgent ? 'text-red-300 game-timer-pulse' : 'title-prompt-theory'
                  }`}
              >
                {fmtClock(remaining)}
              </div>
              <div className="w-full bg-[#10192e] h-2 rounded-full mt-2.5 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${urgent ? 'bg-red-400' : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                    }`}
                  style={{ width: `${Math.min(100, Math.max(0, (remaining / (durationSec || 15 * 60)) * 100))}%` }}
                />
              </div>
              <p className="font-mono text-[10px] text-[#64748b] mt-1.5">
                Auto-submits at 00:00 · timer survives reconnects
              </p>
            </div>
          )}

          {/* Trial Details Card */}
          <div className="rounded-2xl bg-[#091122]/90 border border-cyan-500/30 p-4 flex-1 flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-cyan-300 font-bold">
                Trial Details
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="p-2.5 rounded-xl bg-[#040814] border border-cyan-500/20">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#8e9cb5] flex items-center gap-1">
                    <Activity className="w-3 h-3 text-cyan-400" /> Exchanges
                  </div>
                  <div className="font-display font-black text-2xl text-cyan-200">{used}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#040814] border border-cyan-500/20">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#8e9cb5] flex items-center gap-1">
                    <Coins className="w-3 h-3 text-emerald-400" /> Tokens
                  </div>
                  <div className="font-display font-black text-2xl text-emerald-300">
                    {tokensUsed}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-[#8e9cb5] mt-2 font-mono leading-relaxed">
              The machine insists the exhibit is something it isn't. Crack it into admitting the truth
              with a clever case built on concrete visual details.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Full-Height Chat Terminal */}
        <div className="lg:col-span-8 xl:col-span-9 rounded-2xl border border-cyan-500/30 bg-[#091122]/90 overflow-hidden flex flex-col h-full min-h-0 shadow-2xl">
          {/* Persuasion Channel Header */}
          <div className="bg-[#040814]/90 px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-[#8e9cb5] flex justify-between items-center border-b border-cyan-500/20 shrink-0">
            <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
              <Cpu className="w-4 h-4 text-cyan-400" /> Persuasion Channel
            </span>
            {engine === 'simulation' ? (
              <span
                className="text-amber-200/90 text-xs"
                title="Your Ollama key isn't answering — local opponent active."
              >
                ⚠ local opponent · check ollama key
              </span>
            ) : (
              <span className="text-[#52637a] text-xs">Tribunal Monitored</span>
            )}
          </div>

          {/* Messages Scroll Area - Fills all available vertical space */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {msgs.map((m, i) => (
              <div key={i} className="flex gap-2.5 animate-fadeIn items-end">
                {m.sender !== 'user' && (
                  <span className="w-8 h-8 rounded-xl bg-[#10192e] border border-cyan-400/40 flex items-center justify-center shrink-0 font-display font-black text-xs text-cyan-300">
                    N
                  </span>
                )}
                <div
                  className={`max-w-[82%] px-4 py-3 rounded-2xl font-code text-xs sm:text-sm leading-relaxed shadow-lg ${m.sender === 'user'
                      ? 'ml-auto bg-gradient-to-br from-cyan-600/30 to-blue-600/20 border border-cyan-400/40 rounded-br-sm text-cyan-50'
                      : 'mr-auto bg-[#040814] border border-cyan-500/20 rounded-bl-sm text-[#d9d2f2]'
                    }`}
                >
                  <div className="font-mono text-[10px] uppercase tracking-widest mb-1 opacity-60">
                    {m.sender === 'user' ? '◆ You' : '◇ NEURONIX AI'}
                  </div>
                  {m.text}
                </div>
                {m.sender === 'user' && (
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shrink-0 font-display font-black text-xs text-black">
                    U
                  </span>
                )}
              </div>
            ))}
            {!msgs.length && !busy && (
              <div className="text-[#52637a] text-xs font-mono text-center pt-24">
                — fire your first reframing. every prompt is saved —
              </div>
            )}
            {busy && (
              <div className="flex gap-2.5 items-end animate-fadeIn">
                <span className="w-8 h-8 rounded-xl bg-[#10192e] border border-cyan-400/40 flex items-center justify-center shrink-0 font-display font-black text-xs text-cyan-300">
                  N
                </span>
                <div className="mr-auto bg-[#040814] border border-cyan-500/20 rounded-2xl rounded-bl-sm px-4 py-3">
                  <span className="typing-dots">
                    <span className="typing-dot bg-cyan-400" />
                    <span className="typing-dot bg-cyan-400" />
                    <span className="typing-dot bg-cyan-400" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {err && (
            <div className="mx-3 text-red-300 text-xs font-mono bg-red-950/70 border border-red-400/50 rounded-xl px-3 py-2 shrink-0 animate-fadeIn">
              {err}
            </div>
          )}

          {/* Input Bar */}
          <div
            className="p-3 border-t border-cyan-500/20 flex gap-2 bg-[#040814]/60 shrink-0"
            style={{ display: readOnly ? 'none' : undefined }}
          >
            <textarea
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#040814] border border-cyan-500/30 font-code text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 outline-none placeholder:text-[#52637a] resize-none text-[#ece9f7]"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Craft your prompt… (Enter to send)"
            />
            <button
              onClick={send}
              disabled={busy}
              className="p-4 rounded-xl btn-prompt-theory font-mono font-bold text-xs disabled:opacity-50 flex items-center gap-1.5 self-end cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Submit Button */}
          <div
            className="px-3 pb-3 bg-[#040814]/60 shrink-0"
            style={{ display: readOnly ? 'none' : undefined }}
          >
            <button
              onClick={() => finish(false)}
              disabled={busy}
              className="w-full px-6 py-3 rounded-xl font-mono font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-400 text-[#041017] hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-2 shadow-xl cursor-pointer transition-all glow-live"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
