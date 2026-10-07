import { useState, useEffect } from 'react';
import { Play, Clock, UserCheck, Fingerprint, ChevronLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import AsciiRipple from '../components/AsciiRipple';
import WarpText from '../components/WarpText';
import { saveParticipant, getStoredParticipant } from '../utils/storage';
import { soundFX } from '../utils/audio';
import { enterFullscreen } from '../utils/fullscreen';
import type { Participant } from '../types';

export default function HeroHome({
  onParticipantReady,
}: {
  onParticipantReady: (p: Participant) => void;
}) {
  const existingParticipant = getStoredParticipant();
  const [showForm, setShowForm] = useState(false);

  // Form states — name + register no + year only (AI keys come from the server pool).
  const [name, setName] = useState(existingParticipant?.name || '');
  const [registerNo, setRegisterNo] = useState(existingParticipant?.registerNo || '');
  const [year, setYear] = useState(existingParticipant?.year || (existingParticipant as any)?.college || 'II');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = getStoredParticipant();
    if (!p) {
      setName('');
      setRegisterNo('');
      setYear('II');
    } else {
      setName(p.name || '');
      setRegisterNo(p.registerNo || '');
      setYear(p.year || (p as any).college || 'II');
    }
  }, [showForm]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');

    setLoading(true);
    try {
      const res = await fetch('/api/participant/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          registerNo: registerNo.trim(),
          year: year.trim(),
          college: year.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      saveParticipant(data.participant);
      void enterFullscreen();
      soundFX.playSuccess();
      onParticipantReady(data.participant);
    } catch (ex: any) {
      soundFX.playFail();
      setErr(ex.message || 'An error occurred while entering the event.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative w-full h-screen max-h-screen overflow-hidden bg-[#060813] text-[#ece9f7] flex flex-col items-center justify-center select-none">
      {/* Background with ASCII Ripple liquid waves & high-alpha upward typing stream */}
      <AsciiRipple />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-4xl px-4 flex flex-col items-center justify-center">
        {!showForm ? (
          /* =========================================================================
             HERO VIEW (Clean, minimalist, wow factor)
             Contains ONLY: Title with WarpText, Total timing 30 + 45 min, and START button
             ========================================================================= */
          <div className="w-full text-center flex flex-col items-center space-y-4 sm:space-y-6 animate-fadeIn">
            {/* Department Indicator Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0a1122]/90 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] tracking-widest uppercase shadow-lg backdrop-blur-md">
              <span className="relative flex w-2 h-2">
                <span className="absolute w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                <span className="w-2 h-2 bg-emerald-400 rounded-full" />
              </span>
              DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING
            </div>

            {/* Event Title with interactive WarpText */}
            <div className="w-full flex flex-col items-center justify-center">
              <div className="w-full max-w-3xl h-28 sm:h-36 md:h-44 relative flex items-center justify-center">
                <WarpText
                  text="PROMPT THEORY"
                  color="#67e8f9"
                  warpStrength={0.09}
                  warpScale={1.8}
                  speed={0.6}
                  pointerInfluence={0.45}
                  pointerStrength={0.42}
                  refraction={0.022}
                  ripple
                  fontSize="clamp(3rem, 8vw, 6.2rem)"
                  fontWeight={900}
                  fontFamily="'Orbitron', sans-serif"
                  letterSpacing="0.04em"
                  style={{ height: '100%', width: '100%' }}
                />
              </div>
              <p className="font-mono text-xs sm:text-sm text-cyan-300/80 tracking-widest uppercase -mt-2">
                VENUE -&gt; PROJECT LAB
              </p>
            </div>

            {/* Total Timing: 15 min + 1 hr */}
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-[#0b1426]/90 border border-cyan-500/40 text-xs sm:text-sm font-mono text-cyan-200 shadow-2xl backdrop-blur-md">
              <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-[#8e9cb5] font-semibold tracking-wide">TOTAL DURATION:</span>
              <span className="text-white font-extrabold text-base tracking-widest px-2 py-0.5 rounded-lg bg-cyan-950/60 border border-cyan-400/40">
                15 MIN + 1 HR
              </span>
            </div>

            {/* Start Button */}
            <div className="pt-2 flex flex-col items-center gap-3">
              <button
                id="hero-start-btn"
                onClick={() => {
                  soundFX.playClick();
                  setShowForm(true);
                }}
                className="btn-prompt-theory px-4 py-4 rounded-full font-mono text-base flex items-center justify-center gap-3 shadow-2xl cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" /> 
                {/* <span>START</span>
                 <ArrowRight className="w-5 h-5" /> */}
              </button>

              {existingParticipant && (
                <div className="font-mono text-[11px] text-emerald-400/80 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Existing session: <b>{existingParticipant.name}</b> ({existingParticipant.registerNo})
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
           /* =========================================================================
              FORM AREA (Appears directly within the hero view after clicking START)
              Participant enrollment: name + register no + year (AI keys are
              assigned automatically from the organizer's server pool)
              ========================================================================= */
          <div className="w-full max-w-lg mx-auto animate-fadeIn">
            <div className="rounded-3xl bg-[#091122]/95 border border-cyan-500/40 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl glow-live">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3 mb-4">
                <div>
                  <div className="font-display font-black text-xl tracking-wider title-prompt-theory">
                    PROMPT THEORY
                  </div>
                  <div className="font-mono text-[11px] text-cyan-400/70 tracking-widest">
                    PARTICIPANT ENROLLMENT
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-950/70 border border-cyan-400/30 text-[11px] font-mono text-cyan-300">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>15 MIN + 1 HR</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Full Name */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider font-mono text-cyan-200">
                    Full Name
                  </label>
                  <div className="relative mt-1">
                    <UserCheck className="absolute left-3 top-2.5 w-4 h-4 text-cyan-500/60" />
                    <input
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#040814]/90 border border-cyan-500/30 text-sm font-sans focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 outline-none placeholder:text-[#52637a] text-white"
                      placeholder="e.g. Arun Kumar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Register No */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider font-mono text-cyan-200">
                    Register No / Unique ID
                  </label>
                  <div className="relative mt-1">
                    <Fingerprint className="absolute left-3 top-2.5 w-4 h-4 text-cyan-500/60" />
                    <input
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#040814]/90 border border-cyan-500/30 text-sm font-sans focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 outline-none placeholder:text-[#52637a] text-white"
                      placeholder="e.g. 717822P101"
                      value={registerNo}
                      onChange={(e) => setRegisterNo(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Year Select */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider font-mono text-cyan-200">
                    Year
                  </label>
                  <div className="relative mt-1">
                    <select
                      className="w-full px-3 py-2 rounded-xl bg-[#040814]/90 border border-cyan-500/30 text-sm font-sans focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 outline-none text-white cursor-pointer"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      required
                    >
                      <option value="II" className="bg-[#040814] text-white">II (2nd Year)</option>
                      <option value="III" className="bg-[#040814] text-white">III (3rd Year)</option>
                    </select>
                  </div>
                </div>

                <p className="text-[10px] text-[#6b7c96] font-mono mt-1 leading-tight">
                  Just your name, register no and year — the event assigns your AI access automatically.
                </p>

                {/* Error Banner */}
                {err && (
                  <div className="text-red-300 text-xs font-mono bg-red-950/80 border border-red-400/50 rounded-xl px-3 py-2 animate-fadeIn">
                    {err}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playClick();
                      setShowForm(false);
                    }}
                    className="w-1/3 px-3 py-2.5 rounded-xl font-mono text-xs bg-[#10192e] hover:bg-[#182645] border border-cyan-500/30 text-cyan-300 flex items-center justify-center gap-1 cursor-pointer transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" /> BACK
                  </button>
                  <button
                    disabled={loading}
                    className="w-2/3 px-3 py-2.5 rounded-xl font-mono font-bold text-xs btn-prompt-theory flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      'CONNECTING…'
                    ) : (
                      <>
                        <span>ENTER CHALLENGE</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
