import { Scale, Zap, Search, ShieldCheck, Trophy } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-[#4a3670]/60 bg-[#0a0614]/90 py-10 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-amber-400 p-0.5 rounded-[10px]">
              <span className="bg-[#0a0614] rounded-[10px] p-1.5 flex">
                <Scale className="w-4 h-4 text-amber-200" />
              </span>
            </span>
            <span className="font-display font-black tracking-wider text-sm title-tribunal">
              MIDNIGHT TRIBUNAL
            </span>
          </div>
          <p className="text-xs text-[#8f86ad] mt-3 font-mono leading-relaxed">
            One tribunal. Two trials.<br />Persuade the machine.<br />Then catch the killer.
          </p>
        </div>
        <div>
          <h4 className="label-gold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-fuchsia-300" /> Round 1
          </h4>
          <p className="text-xs text-[#8f86ad] mt-2 font-mono leading-relaxed">
            1 image · open chat · 30-min timer ·<br />efficiency verdict
          </p>
        </div>
        <div>
          <h4 className="label-gold flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-emerald-300" /> Round 2
          </h4>
          <p className="text-xs text-[#8f86ad] mt-2 font-mono leading-relaxed">
            4 suspects · forensic clues ·<br />1 charge-sheet
          </p>
        </div>
        <div>
          <h4 className="label-gold flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-200" /> Verdict
          </h4>
          <p className="text-xs text-[#8f86ad] mt-2 font-mono leading-relaxed flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0 mt-0.5" />
            <span>One final score out of 100 ·<br />declared by the tribunal only</span>
          </p>
        </div>
      </div>
      <p className="text-center text-[11px] font-mono text-[#5f5585] border-t border-[#4a3670]/40 mt-8 pt-4">
        MIDNIGHT TRIBUNAL · Case File #2026-FE · Collegiate Arena
      </p>
    </footer>
  );
}
