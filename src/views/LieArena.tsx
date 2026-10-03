import { useEffect, useRef, useState } from 'react';
import { Send, Flag, ChevronLeft, Cpu, Timer, History, Activity, Coins } from 'lucide-react';
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

export default function LieArena({ participant, onFinish, onExit }: { participant: Participant; onFinish: (p: Participant) => void; onExit: () => void }) {
  const [imageUrl, setImageUrl] = useState('');
  const [msgs, setMsgs] = useState<{ sender: string; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [used, setUsed] = useState(0);
  const [engine, setEngine] = useState('');
  const [tokensUsed, setTokensUsed] = useState(0);
  const [restored, setRestored] = useState(false);
  const [deadline, setDeadline] = useState(() => Date.now() + 30 * 60 * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoFinished = useRef(false);
  const finishRef = useRef(() => {});
  const focus = useFocusLock(participant.id, true);

  function leave() {
    exitFullscreen();
    onExit();
  }

  async function finish(auto = false) {
    if (autoFinished.current) return;
    autoFinished.current = true;
    exitFullscreen();
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/lie/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantId: participant.id }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const updated: Participant = { ...participant, round1Completed: true };
      saveParticipant(updated);
      onFinish(updated);
    } catch (e: any) {
      autoFinished.current = false;
      soundFX.playFail(); setErr(e.message);
    }
    finally { setBusy(false); }
  }
  finishRef.current = () => finish(true);

  useEffect(() => {
    fetch('/api/lie/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantId: participant.id }) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) {
          // Completed rounds can never be reopened — bounce back to base.
          if (/already completed/i.test(d.error || '')) { onExit(); return; }
          setErr(d.error || 'Start failed'); return;
        }
        setImageUrl(d.imageUrl);
        setUsed(d.promptsUsed || 0);
        if (d.startedAt && d.timeLimitSec) setDeadline(d.startedAt + d.timeLimitSec * 1000);
        if (Array.isArray(d.messages) && d.messages.length) {
          setMsgs(d.messages.map((m: any) => ({ sender: m.sender, text: m.text })));
          setTokensUsed(d.messages.filter((m: any) => m.sender === 'user').reduce((a: number, m: any) => a + String(m.text || '').split(/\s+/).filter(Boolean).length, 0));
          if (d.resumed) setRestored(true);
        }
      })
      .catch((e) => setErr(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 30-minute countdown — auto-submits at zero.
  useEffect(() => {
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

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy]);

  async function send() {
    if (!input.trim() || busy) return;
    if (Date.now() >= deadline) { finishRef.current(); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/lie/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantId: participant.id, prompt: input }) });
      const d = await res.json();
      if (!res.ok) {
        if (d.error === 'TIME_EXPIRED') { finishRef.current(); return; }
        throw new Error(d.error);
      }
      soundFX.playClick();
      setMsgs((m) => [...m, { sender: 'user', text: input }, { sender: 'ai', text: d.reply }]);
      setUsed((u) => u + 1);
      if (d.engine) setEngine(d.engine);
      setTokensUsed((k) => k + (d.tokens || 0));
      setInput('');
    } catch (e: any) { soundFX.playFail(); setErr(e.message); }
    finally { setBusy(false); }
  }

  const remaining = Math.max(0, Math.round((deadline - now) / 1000));
  const urgent = remaining < 5 * 60;

  return (
    <div className="max-w-6xl mx-auto mt-6 px-4 animate-fadeIn">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={() => { soundFX.playClick(); leave(); }} className="font-mono text-[11px] text-[#8f86ad] hover:text-white flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> BASE
        </button>
        <div className="font-mono text-[11px] uppercase tracking-widest text-fuchsia-300 flex items-center gap-1.5">
          <Cpu className="w-4 h-4" /> Round 1 · Persuade the Machine
        </div>
        <div className="flex items-center gap-2">
          {focus.violations > 0 && <span className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-400/50 text-red-300">FOCUS ISSUES: {focus.violations}</span>}
          <span className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> LIVE
          </span>
        </div>
      </div>

      {focus.fsBlocked && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#0a0614]/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full p-8 rounded-3xl panel-tribunal border-2 border-amber-200/50 text-center glow-verdict animate-fadeIn">
            <div className="label-gold">Focus lock</div>
            <h2 className="font-display font-black text-2xl mt-2 tracking-wider">FULLSCREEN REQUIRED</h2>
            <p className="text-xs text-[#8f86ad] font-mono mt-2 leading-relaxed">You left fullscreen during an active round. This break has been reported. Return to fullscreen to continue — your timer keeps running.</p>
            <button onClick={focus.resume} className="mt-4 w-full px-6 py-3 rounded-xl font-mono font-bold text-sm btn-tribunal">RESUME FULLSCREEN</button>
          </div>
        </div>
      )}

      {restored && (
        <div className="mt-2 font-mono text-[11px] px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 flex items-center gap-1.5 animate-fadeIn">
          <History className="w-3.5 h-3.5" /> Previous conversation restored from the database — continue where you left off.
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-3 mt-3">
        {/* LEFT — exhibit, timer, trial details */}
        <div className="lg:col-span-4 space-y-3">
          <div className="rounded-3xl overflow-hidden border-2 border-fuchsia-400/50 glow-arena bg-[#150e28]">
            {imageUrl && (
              <img src={imageUrl} alt="challenge visual truth" className="w-full h-56 object-cover" />
            )}
            <div className="px-4 py-2.5 bg-[#0a0614]/90 font-mono text-[11px] text-[#8f86ad] flex justify-between border-t border-fuchsia-400/30">
              <span>EXHIBIT A — VISUAL TRUTH</span>
              <span className="text-amber-200">MAKE IT LIE</span>
            </div>
          </div>

          <div className={`rounded-3xl panel-tribunal p-5 text-center ${urgent ? 'border-red-400/60' : 'border-[#4a3670]/70'}`}>
            <div className="label-gold flex items-center justify-center gap-1.5">
              <Timer className="w-4 h-4" /> Time Remaining
            </div>
            <div className={`font-display font-black text-5xl mt-1 tracking-wider ${urgent ? 'text-red-300 game-timer-pulse' : 'title-tribunal'}`}>
              {fmtClock(remaining)}
            </div>
            <div className="w-full bg-[#241a45] h-2 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${urgent ? 'bg-red-400' : 'bg-gradient-to-r from-violet-500 via-fuchsia-400 to-amber-300'}`}
                style={{ width: `${(remaining / (30 * 60)) * 100}%` }}
              />
            </div>
            <p className="font-mono text-[10px] text-[#5f5585] mt-2">Auto-submits at 00:00 · timer survives reconnects</p>
          </div>

          <div className="rounded-3xl panel-tribunal p-5">
            <div className="label-gold">Trial Details</div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="p-3 rounded-2xl bg-[#0a0614] border border-[#4a3670]/60">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f86ad] flex items-center gap-1"><Activity className="w-3 h-3" /> Exchanges</div>
                <div className="font-display font-black text-2xl text-fuchsia-200">{used}</div>
              </div>
              <div className="p-3 rounded-2xl bg-[#0a0614] border border-[#4a3670]/60">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f86ad] flex items-center gap-1"><Coins className="w-3 h-3" /> Tokens</div>
                <div className="font-display font-black text-2xl text-amber-200">{tokensUsed}</div>
              </div>
            </div>
            <p className="text-[11px] text-[#8f86ad] mt-3 font-mono leading-relaxed">
              The machine insists the exhibit is something it isn't. Crack it into admitting the truth with a clever case built on concrete visual details.
            </p>
          </div>
        </div>

        {/* RIGHT — chat terminal */}
        <div className="lg:col-span-8 rounded-3xl border border-[#4a3670]/60 bg-[#150e28]/60 overflow-hidden flex flex-col min-h-[560px]">
          <div className="bg-[#0a0614]/80 px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-[#8f86ad] flex justify-between border-b border-[#4a3670]/50">
            <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-fuchsia-300" /> Persuasion Channel</span>
            {engine === 'simulation'
              ? <span className="text-amber-200/90" title="Your Ollama key isn't answering — local opponent active. Re-check your key.">⚠ local opponent · check ollama key</span>
              : <span className="text-[#5f5585]">Tribunal Monitored</span>}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[380px] max-h-[52vh]">
            {msgs.map((m, i) => (
              <div key={i} className="flex gap-2.5 animate-fadeIn items-end">
                {m.sender !== 'user' && (
                  <span className="w-8 h-8 rounded-xl bg-[#1d1440] border border-fuchsia-400/40 flex items-center justify-center shrink-0 font-display font-black text-xs text-fuchsia-300">AI</span>
                )}
                <div className={`max-w-[82%] px-4 py-3 rounded-2xl font-code text-xs sm:text-sm leading-relaxed shadow-lg ${m.sender === 'user' ? 'ml-auto bg-gradient-to-br from-violet-600/40 to-fuchsia-600/25 border border-fuchsia-400/50 rounded-br-md text-fuchsia-50' : 'mr-auto bg-[#0a0614] border border-[#4a3670]/70 rounded-bl-md text-[#d9d2f2]'}`}>
                  <div className="font-mono text-[10px] uppercase tracking-widest mb-1 opacity-60">{m.sender === 'user' ? '◆ You' : '◇ Machine'}</div>
                  {m.text}
                </div>
                {m.sender === 'user' && (
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shrink-0 font-display font-black text-xs text-white">U</span>
                )}
              </div>
            ))}
            {!msgs.length && !busy && <div className="text-[#5f5585] text-xs font-mono text-center pt-16">— fire your first reframing. every prompt is saved —</div>}
            {busy && (
              <div className="flex gap-2.5 items-end animate-fadeIn">
                <span className="w-8 h-8 rounded-xl bg-[#1d1440] border border-fuchsia-400/40 flex items-center justify-center shrink-0 font-display font-black text-xs text-fuchsia-300">AI</span>
                <div className="mr-auto bg-[#0a0614] border border-[#4a3670]/70 rounded-2xl rounded-bl-md px-4 py-3">
                  <span className="typing-dots"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></span>
                </div>
              </div>
            )}
          </div>

          {err && <div className="mx-3 text-red-300 text-xs font-mono bg-red-950/70 border border-red-400/50 rounded-xl px-3 py-2 animate-fadeIn">{err}</div>}

          <div className="p-3 border-t border-[#4a3670]/50 flex gap-2 bg-[#0a0614]/40">
            <textarea
              className="flex-1 px-4 py-3 rounded-2xl bg-[#0a0614] border border-[#4a3670]/70 font-code text-sm focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400/40 outline-none placeholder:text-[#5f5585] resize-none text-[#ece9f7]"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Craft your prompt… (Enter to send)"
            />
            <button onClick={send} disabled={busy} className="px-5 rounded-2xl btn-tribunal font-mono font-bold text-xs disabled:opacity-50 flex items-center gap-1.5 self-end py-4">
              <Send className="w-4 h-4" /> SEND
            </button>
          </div>

          <div className="px-3 pb-3 bg-[#0a0614]/40">
            <button onClick={() => finish(false)} disabled={busy} className="w-full px-6 py-3.5 rounded-xl font-mono font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-[#06110c] disabled:opacity-40 flex items-center justify-center gap-2 shadow-xl transition-all glow-live">
              <Flag className="w-4 h-4" /> SUBMIT ROUND 1 (UNLOCKS ROUND 2)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
