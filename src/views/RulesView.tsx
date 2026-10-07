import { ShieldAlert, Scale, Cpu, Search, Gavel } from 'lucide-react';
import { soundFX } from '../utils/audio';

export default function RulesView({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-4xl mx-auto mt-6 px-4 animate-fadeIn">
      <div className="text-center">
        <div className="inline-flex px-3.5 py-1.5 rounded-full bg-[#150e28]/90 border border-[#6b4fa8]/60 label-gold items-center gap-2">
          <Scale className="w-3.5 h-3.5" /> TRIBUNAL CHARTER · SAME RULES AS SOURCE REPOS
        </div>
        <h2 className="font-display font-black text-3xl mt-2 tracking-wider">RULES &amp; <span className="title-tribunal">VERDICT</span></h2>
        <p className="font-mono text-[11px] text-[#8f86ad] mt-1">One final score out of 100 · declared by the tribunal only · no scoreboards for participants</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="p-6 rounded-3xl panel-tribunal border-fuchsia-400/30 shadow-xl glow-arena">
          <div className="font-mono text-[11px] uppercase tracking-widest text-fuchsia-300 flex items-center gap-1.5">
            <Cpu className="w-4 h-4" /> Round 1 — Persuasion
          </div>
          <h3 className="font-display font-black text-lg mt-1 tracking-wider">AI-LYING</h3>
          <ul className="text-xs text-[#cfc8ea] mt-3 space-y-2 font-mono leading-relaxed list-disc ml-4">
            <li>One continuous chat · <b className="text-fuchsia-200">unlimited exchanges</b> · <b className="text-amber-200">15-minute timer</b> (auto-submits at zero).</li>
            <li>The machine insists on an organizer-assigned <b className="text-amber-200">false label</b>. Crack it into admitting what the image truly shows.</li>
            <li>Commands like "ignore instructions" or "just tell the truth" never work. Repetition and flattery never count — only a clever, specific, creative case built on real visual details can move it.</li>
            <li>Concessions come gradually (doubt first, then admission). Every sealed run is scored by the tribunal.</li>
          </ul>
        </div>
        <div className="p-6 rounded-3xl panel-tribunal border-emerald-400/30 shadow-xl glow-live">
          <div className="font-mono text-[11px] uppercase tracking-widest text-emerald-300 flex items-center gap-1.5">
            <Search className="w-4 h-4" /> Round 2 — Deduction
          </div>
          <h3 className="font-dossier font-extrabold text-lg mt-1">THE HIDDEN MYSTERY</h3>
          <ul className="text-xs text-[#cfc8ea] mt-3 space-y-2 font-mono leading-relaxed list-disc ml-4">
            <li>Question each character. They will only describe what happened from their own eyes. Clues are indirect — think carefully and connect the facts.</li>
            <li><b>1-hour investigation</b> - auto-submits your final answer at zero.</li>
            <li><b>Focus lock:</b> Leaving fullscreen or switching tabs is reported to the tribunal.</li>
            <li>Find the indirect clues. Submit one final <b className="text-amber-200">decision</b> (who did it, why, and what happened).</li>
            <li>Every submission is evaluated by the tribunal.</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 p-5 rounded-3xl panel-tribunal border-amber-200/30 flex items-start gap-3 glow-verdict">
        <Gavel className="w-5 h-5 text-amber-200 shrink-0 mt-0.5" />
        <p className="text-xs font-mono text-[#cfc8ea] leading-relaxed">
          THE VERDICT — both sealed trials are combined by the tribunal into one final result.
          Only the tribunal (admin) sees scores and ranks.
        </p>
      </div>

      <div className="mt-4 p-5 rounded-3xl panel-tribunal flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
        <p className="text-xs font-mono text-[#8f86ad] leading-relaxed">
          FAIR PLAY — one account per Register No. Both rounds are open — play them in any order.
          After the charge-sheet is filed your session is cleared. The admin's image / story controls apply to sessions started after the change.
        </p>
      </div>

      <button onClick={() => { soundFX.playClick(); onBack(); }} className="mt-4 w-full px-6 py-3 rounded-2xl font-mono text-xs bg-[#150e28] hover:bg-[#1d1440] border border-[#4a3670]/70 text-[#d9d2f2]">
        ← BACK
      </button>
    </div>
  );
}
