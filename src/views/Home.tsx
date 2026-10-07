import { Zap, Search, BookOpen, LogOut, Lock, CheckCircle2 } from 'lucide-react';
import { soundFX } from '../utils/audio';
import type { Participant } from '../types';

export default function Home({ participant, onStartLie, onStartDetective, onRules, onLogout }: {
  participant: Participant;
  onStartLie: () => void;
  onStartDetective: () => void;
  onRules: () => void;
  onLogout: () => void;
}) {
  const r1 = participant.round1Completed;
  const r2 = participant.round2Completed;
  return (
    <div className="w-full h-screen max-h-screen overflow-hidden flex flex-col justify-center items-center px-4 bg-[#060813] select-none">
      <div className="w-full max-w-3xl animate-fadeIn">
        <div className="text-center">
          <div className="inline-flex px-4 py-1.5 rounded-full bg-[#0a1122]/90 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            INVESTIGATOR: {participant.name.toUpperCase()} · {participant.registerNo}
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl mt-3 tracking-wider title-prompt-theory">
            PROMPT THEORY
          </h2>
          <p className="font-mono text-xs sm:text-sm text-cyan-300/70 mt-1">
            Complete Round 1 (15m) to unlock Round 2 (1h).
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          {/* ROUND 1 — Persuasion */}
          <div className="p-6 rounded-3xl bg-[#091122]/90 border border-cyan-500/30 shadow-xl glow-live backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-300 flex items-center gap-1.5 font-bold">
                <Zap className="w-4 h-4 text-cyan-400" /> Round 1 · 15 Min
              </span>
              {r1
                ? <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> SEALED</span>
                : <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-400/40 text-cyan-200">● OPEN</span>}
            </div>
            <h3 className="font-display font-black text-xl mt-2 tracking-wider text-white">AI-LYING</h3>
            <p className="text-xs text-[#8f9eb5] mt-1 font-mono leading-relaxed">
              Chat freely within 15 minutes. Break through the AI defense to reveal the true label.
            </p>
            <button onClick={() => { soundFX.playClick(); onStartLie(); }} className={`mt-4 w-full px-6 py-3 rounded-xl font-mono font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${r1 ? 'bg-[#10192e] text-cyan-200 hover:bg-[#182645]' : 'btn-prompt-theory'}`}>
              {r1 ? 'VIEW ROUND 1' : <><Zap className="w-4 h-4" /> START ROUND 1</>}
            </button>
          </div>

          {/* ROUND 2 — Deduction */}
          <div className={`p-6 rounded-3xl bg-[#091122]/90 shadow-xl backdrop-blur-md transition-all ${!r1 ? 'opacity-70 border border-[#1e293b]' : r2 ? 'border border-emerald-400/40 glow-live' : 'border border-cyan-400/40 glow-live'}`}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-widest text-emerald-300 flex items-center gap-1.5 font-bold">
                <Search className="w-4 h-4 text-emerald-400" /> Round 2 · 1 Hour
              </span>
              {r2
                ? <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> SEALED</span>
                : !r1
                  ? <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#040814] border border-[#334155] text-[#64748b] flex items-center gap-1"><Lock className="w-3 h-3" /> LOCKED</span>
                  : <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">● UNLOCKED</span>}
            </div>
            <h3 className="font-dossier font-extrabold text-xl mt-2 text-white">THE HIDDEN MYSTERY</h3>
            <p className="text-xs text-[#8f9eb5] mt-1 font-mono leading-relaxed">
              Question 4 suspects, discover indirect clues, submit your final answer. 1 hour time limit.
            </p>
            <button onClick={() => { soundFX.playClick(); onStartDetective(); }} disabled={!r1} className={`mt-4 w-full px-6 py-3 rounded-xl font-mono font-bold text-sm cursor-pointer transition-all ${!r1 ? 'bg-[#10192e] text-[#64748b] cursor-not-allowed' : r2 ? 'bg-[#10192e] text-cyan-200 hover:bg-[#182645]' : 'bg-gradient-to-r from-emerald-500 to-teal-400 text-[#041017] hover:brightness-110'}`}>
              {!r1 ? 'LOCKED - FINISH ROUND 1 FIRST' : r2 ? 'VIEW ROUND 2' : 'OPEN CASE FILE'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={onRules} className="px-4 py-2.5 rounded-xl bg-[#0b1426] hover:bg-[#10192e] border border-cyan-500/30 font-mono text-xs text-cyan-200 flex items-center justify-center gap-1.5 cursor-pointer transition-all">
            <BookOpen className="w-4 h-4 text-cyan-400" /> RULES
          </button>
          <button onClick={onLogout} className="px-4 py-2.5 rounded-xl bg-[#0b1426] hover:bg-red-950/40 border border-red-500/30 font-mono text-xs text-red-300 flex items-center justify-center gap-1.5 cursor-pointer transition-all">
            <LogOut className="w-4 h-4" /> LOGOUT
          </button>
        </div>
      </div>
    </div>
  );
}
