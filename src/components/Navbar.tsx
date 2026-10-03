import { Scale, Volume2, VolumeX, BookOpen, Shield, Home, Zap, Search } from 'lucide-react';
import { soundFX } from '../utils/audio';

export type NavView = 'landing' | 'home' | 'lie' | 'detective' | 'rules' | 'admin';

const ALL_LINKS: { id: NavView; label: string; icon: any; adminOnly?: boolean }[] = [
  { id: 'home', label: 'Base', icon: Home },
  { id: 'lie', label: 'Round 1', icon: Zap },
  { id: 'detective', label: 'Round 2', icon: Search },
  { id: 'rules', label: 'Rules', icon: BookOpen },
  { id: 'admin', label: 'Admin', icon: Shield, adminOnly: true },
];

export default function Navbar({ current, go, whoLabel, isParticipant, soundOn, onToggleSound }: {
  current: string;
  go: (v: NavView) => void;
  whoLabel: string | null;
  isParticipant: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
}) {
  // Participants must never see the admin entry — admins and logged-out users do.
  const LINKS = ALL_LINKS.filter((l) => !l.adminOnly || !isParticipant);
  return (
    <nav className="sticky top-0 z-50 bg-[#0a0614]/85 backdrop-blur-md border-b border-[#4a3670]/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
        <button
          onClick={() => { soundFX.playClick(); go('landing'); }}
          className="flex items-center gap-2.5 group"
        >
          <span className="bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-amber-400 p-0.5 rounded-[10px] group-hover:brightness-110 shadow-xl transition-all">
            <span className="bg-[#0a0614] rounded-[10px] p-1.5 flex">
              <Scale className="w-5 h-5 text-amber-200" />
            </span>
          </span>
          <span className="text-left leading-none">
            <span className="block font-display font-black tracking-wider text-sm title-tribunal">
              MIDNIGHT TRIBUNAL
            </span>
            <span className="block label-gold mt-0.5" style={{ fontSize: 9 }}>
              Lie × Mystery Arena
            </span>
          </span>
        </button>

        <div className="hidden lg:flex items-center gap-1">
          {LINKS.map((l) => {
            const active = current === l.id;
            const Icon = l.icon;
            return (
              <button
                key={l.id}
                onClick={() => { soundFX.playClick(); go(l.id); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs uppercase tracking-widest transition-all ${
                  active
                    ? 'bg-[#1d1440] text-amber-200 border border-[#6b4fa8]/60 shadow-lg'
                    : 'text-[#b9b0d8] hover:text-white hover:bg-[#1d1440]/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {l.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSound}
            className="p-2 rounded-lg border border-[#4a3670]/60 text-[#b9b0d8] hover:text-white hover:bg-[#1d1440]/60 transition-all"
            title="Toggle sound"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          {whoLabel ? (
            <span className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#150e28] border border-[#4a3670]/70 font-mono text-[11px] text-[#d9d2f2] max-w-[220px] truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="truncate">{whoLabel}</span>
            </span>
          ) : (
            <span className="hidden sm:block px-3 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-widest btn-tribunal">
              Enter Tribunal
            </span>
          )}
        </div>
      </div>
      <div className="flex lg:hidden overflow-x-auto py-2 px-4 gap-1 border-t border-[#4a3670]/40">
        {LINKS.map((l) => {
          const active = current === l.id;
          const Icon = l.icon;
          return (
            <button
              key={l.id}
              onClick={() => { soundFX.playClick(); go(l.id); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-widest whitespace-nowrap ${
                active ? 'bg-[#1d1440] text-amber-200 border border-[#6b4fa8]/60' : 'text-[#b9b0d8]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {l.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
