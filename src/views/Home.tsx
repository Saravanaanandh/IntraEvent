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
    <div className="max-w-4xl mx-auto mt-8 px-4 animate-fadeIn">
      <div className="text-center">
        <div className="inline-flex px-3.5 py-1.5 rounded-full bg-[#150e28]/90 border border-[#6b4fa8]/60 label-gold items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          INVESTIGATOR: {participant.name.toUpperCase()} · {participant.registerNo}
        </div>
        <h2 className="font-display font-black text-2xl sm:text-3xl mt-3 tracking-wider">
          FACE YOUR <span className="title-tribunal">TRIALS</span>
        </h2>
        <p className="font-type italic text-sm text-[#8f86ad] mt-1">Complete Round 1 to unlock Round 2. Chat, submit — the tribunal scores the rest.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        {/* ROUND 1 — arena accent */}
        <div className="p-6 rounded-3xl panel-tribunal border-fuchsia-400/30 shadow-xl glow-arena">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-widest text-fuchsia-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> Round 1 · Persuasion
            </span>
            {r1
              ? <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> SEALED</span>
              : <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-[#0a0614] border border-fuchsia-400/40 text-amber-200">● OPEN</span>}
          </div>
          <h3 className="font-display font-black text-xl mt-2 tracking-wider">AI-LYING</h3>
          <p className="text-xs text-[#8f86ad] mt-1 font-mono leading-relaxed">Chat freely within the time. The machine insists on a false label — crack it into admitting the truth.</p>
          <button onClick={() => { soundFX.playClick(); onStartLie(); }} disabled={r1} className={`mt-4 w-full px-6 py-3 rounded-xl font-mono font-bold text-sm flex items-center justify-center gap-2 transform hover:-translate-y-0.5 ${r1 ? 'bg-[#241a45] text-[#5f5585] cursor-not-allowed' : 'btn-tribunal'}`}>
            {r1 ? 'SEALED ✓' : <><Zap className="w-4 h-4" /> START ROUND 1</>}
          </button>
        </div>

        {/* ROUND 2 — dossier accent */}
        <div className={`p-6 rounded-3xl panel-tribunal shadow-xl ${!r1 ? 'opacity-90' : r2 ? 'border-emerald-400/30' : 'border-amber-200/30 glow-verdict'}`}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-widest text-emerald-300 flex items-center gap-1.5">
              <Search className="w-4 h-4" /> Round 2 · Deduction
            </span>
            {r2
              ? <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> SEALED</span>
              : !r1
                ? <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-[#0a0614] border border-[#4a3670] text-[#5f5585] flex items-center gap-1"><Lock className="w-3 h-3" /> LOCKED</span>
                : <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-amber-400/10 border border-amber-200/30 text-amber-200">● UNLOCKED</span>}
          </div>
          <h3 className="font-dossier font-extrabold text-xl mt-2">THE HIDDEN MYSTERY</h3>
          <p className="text-xs text-[#8f86ad] mt-1 font-mono leading-relaxed">Interrogate 4 suspects, gather forensic clues, file one charge-sheet. 45 minutes on the clock.</p>
          <button onClick={() => { soundFX.playClick(); onStartDetective(); }} disabled={!r1 || r2} className={`mt-4 w-full px-6 py-3 rounded-2xl font-mono font-bold text-sm transition-all ${!r1 || r2 ? 'bg-[#241a45] text-[#5f5585] cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-[#06110c] hover:brightness-110 glow-live'}`}>
            {!r1 ? '🔒 FINISH ROUND 1 FIRST' : r2 ? 'SEALED ✓' : 'OPEN CASE FILE →'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <button onClick={onRules} className="px-4 py-3 rounded-2xl bg-[#150e28]/90 hover:bg-[#1d1440] border border-[#4a3670]/70 hover:border-amber-200/40 font-mono text-xs text-[#d9d2f2] flex items-center justify-center gap-1.5 transition-all">
          <BookOpen className="w-4 h-4 text-amber-200" /> RULES
        </button>
        <button onClick={onLogout} className="px-4 py-3 rounded-2xl bg-[#150e28]/90 hover:bg-red-950/40 border border-[#4a3670]/70 hover:border-red-400/50 font-mono text-xs text-red-300 flex items-center justify-center gap-1.5 transition-all">
          <LogOut className="w-4 h-4" /> LOGOUT
        </button>
      </div>
    </div>
  );
}
