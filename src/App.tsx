import { useState, useEffect } from 'react';
import { Award, ChevronLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import HeroHome from './views/HeroHome';
import AdminLogin from './views/AdminLogin';
import Home from './views/Home';
import LieArena from './views/LieArena';
import DetectiveGame from './views/DetectiveGame';
import AdminDashboard from './views/AdminDashboard';
import RulesView from './views/RulesView';
import { getStoredParticipant, getAdminToken, clearAllCookiesAndStorage, clearAdminToken } from './utils/storage';
import { soundFX } from './utils/audio';
import { enterFullscreen } from './utils/fullscreen';
import type { Participant } from './types';

export type View = 'hero' | 'home' | 'lie' | 'lieresult' | 'detective' | 'thankyou' | 'rules';

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [view, setView] = useState<View>('hero');
  const [participant, setParticipant] = useState<Participant | null>(() => getStoredParticipant());
  const [isAdmin, setIsAdmin] = useState(() => !!getAdminToken());

  useEffect(() => {
    const handlePopState = () => {
      if (view === 'lie' || view === 'detective') {
        window.history.pushState(null, '', window.location.pathname);
        return;
      }
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view]);

  // When participant has completed both rounds, display the Thank You screen
  useEffect(() => {
    if (participant?.round1Completed && participant?.round2Completed) {
      if (view === 'home' || view === 'lie' || view === 'lieresult' || view === 'detective') {
        setView('thankyou');
      }
    }
  }, [participant, view]);

  function logoutParticipant() {
    clearAllCookiesAndStorage();
    setParticipant(null);
    setView('hero');
  }

  function logoutAdmin() {
    clearAdminToken();
    setIsAdmin(false);
  }

  function navigateTo(path: string) {
    window.history.pushState({}, '', path);
    setPathname(path);
  }

  // =========================================================================
  // ADMIN ROUTE (/admin): Dedicated for admin login & dashboard
  // =========================================================================
  if (pathname === '/admin' || pathname.startsWith('/admin')) {
    return (
      <div className="min-h-screen bg-[#060813] text-[#ece9f7] font-sans selection:bg-amber-400 selection:text-black">
        {isAdmin ? (
          <AdminDashboard
            onLogout={() => {
              soundFX.playClick();
              logoutAdmin();
            }}
          />
        ) : (
          <div className="min-h-screen flex items-center justify-center p-4">
            <AdminLogin
              onLogin={() => {
                soundFX.playSuccess();
                setIsAdmin(true);
              }}
              onBack={() => {
                soundFX.playClick();
                navigateTo('/');
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // PARTICIPANT ROUTE (/): No Admin Login option, no Navbar on home
  // =========================================================================
  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[#060813] text-[#ece9f7] flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      <main className="flex-1 h-full overflow-hidden">
        {/* Hero Section: Fixed 100vh, infinite typing background, title, total timing 30+45m, START button */}
        {view === 'hero' && (
          <HeroHome
            onParticipantReady={(p) => {
              setParticipant(p);
              setView('home');
            }}
          />
        )}

        {view === 'home' && participant && (
          <Home
            participant={participant}
            onStartLie={() => {
              soundFX.playClick();
              void enterFullscreen();
              setView('lie');
            }}
            onStartDetective={() => {
              soundFX.playClick();
              void enterFullscreen();
              setView('detective');
            }}
            onRules={() => {
              soundFX.playClick();
              setView('rules');
            }}
            onLogout={() => {
              soundFX.playFail();
              logoutParticipant();
            }}
          />
        )}

        {view === 'lie' && participant && (
          <LieArena
            participant={participant}
            readOnly={participant.round1Completed}
            onFinish={(p) => {
              soundFX.playSuccess();
              setParticipant(p);
              if (p.round2Completed) {
                setView('thankyou');
              } else {
                setView('lieresult');
              }
            }}
            onExit={() => setView('home')}
          />
        )}

        {view === 'lieresult' && participant && (
          <div className="h-screen flex items-center justify-center p-4 bg-[#060813]">
            <div className="max-w-md w-full p-8 rounded-3xl bg-[#091122]/95 border border-cyan-500/40 shadow-2xl glow-live text-center animate-fadeIn">
              <div className="font-mono text-xs text-cyan-300 uppercase tracking-widest">
                Round 1 · Trial Sealed
              </div>
              <h2 className="font-display font-black text-2xl mt-2 tracking-wider text-white">
                ROUND 1 COMPLETE
              </h2>
              <p className="text-xs text-[#8e9cb5] mt-2 font-mono leading-relaxed">
                Your persuasion run has been recorded and sealed.{' '}
                {participant.round2Completed
                  ? 'Both rounds are complete.'
                  : 'You can now proceed to Round 2 — The Hidden Mystery (1 Hour).'}
              </p>
              {!participant.round2Completed && (
                <button
                  onClick={() => {
                    soundFX.playClick();
                    void enterFullscreen();
                    setView('detective');
                  }}
                  className="mt-5 w-full px-6 py-3.5 rounded-2xl font-mono font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-400 text-[#041017] hover:brightness-110 cursor-pointer transition-all shadow-xl"
                >
                  OPEN ROUND 2 (1 HOUR) →
                </button>
              )}
              <button
                onClick={() => setView('home')}
                className="mt-2 w-full px-6 py-3 rounded-2xl font-mono text-xs bg-[#10192e] hover:bg-[#182645] border border-cyan-500/30 text-cyan-200 cursor-pointer transition-all"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

        {view === 'detective' && participant && (
          <DetectiveGame
            participant={participant}
            readOnly={participant.round2Completed}
            onDone={(p) => {
              soundFX.playSuccess();
              setParticipant(p);
              if (p.round1Completed) {
                setView('thankyou');
              } else {
                setView('home');
              }
            }}
            onExit={() => setView('home')}
          />
        )}

        {view === 'thankyou' && participant && (
          <div className="h-screen flex items-center justify-center p-4 bg-[#060813]">
            <div className="relative max-w-lg w-full p-8 rounded-3xl bg-[#091122]/95 border border-cyan-500/40 shadow-2xl glow-live text-center animate-fadeIn overflow-hidden">
              <div className="relative">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-[#10192e] border border-cyan-400/50 flex items-center justify-center shadow-xl">
                  <Award className="w-8 h-8 text-emerald-400" />
                </div>
                
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-mono text-[11px] uppercase tracking-widest mt-4">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Both Rounds Completed &amp; Sealed
                </div>

                <h2 className="font-display font-black text-2xl sm:text-3xl mt-2 text-white tracking-wide">
                  THANK YOU FOR YOUR PARTICIPATION
                </h2>

                <div className="mt-3 px-4 py-2.5 rounded-2xl bg-[#040814]/80 border border-cyan-500/30 text-xs font-mono text-cyan-200">
                  <div className="font-semibold text-white">{participant.name}</div>
                  <div className="text-[11px] text-[#8e9cb5] mt-0.5">
                    Reg No: {participant.registerNo} {participant.year ? `· Year: ${participant.year}` : ''}
                  </div>
                </div>

                <p className="font-sans text-[#8e9cb5] text-xs sm:text-sm mt-3 leading-relaxed">
                  Your submissions for both <b className="text-cyan-300">AI-Lying</b> and <b className="text-emerald-300">The Hidden Mystery</b> have been securely registered. Final scores will be published by the tribunal.
                </p>

                <div className="mt-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-400/30 text-[11px] text-amber-200 font-mono flex items-center gap-2 text-left">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-amber-300" />
                  <span>
                    Clicking <b>BACK</b> clears your stored session so no other participant can resume as you on this machine.
                  </span>
                </div>

                <button
                  id="thankyou-back-btn"
                  onClick={() => {
                    soundFX.playClick();
                    clearAllCookiesAndStorage();
                    setParticipant(null);
                    setView('hero');
                  }}
                  className="mt-5 w-full px-6 py-3.5 rounded-2xl font-mono font-bold text-sm btn-prompt-theory flex items-center justify-center gap-2 cursor-pointer shadow-xl transition-all"
                >
                  <ChevronLeft className="w-5 h-5" /> BACK
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'rules' && (
          <div className="h-screen overflow-y-auto bg-[#060813]">
            <RulesView onBack={() => setView(participant ? 'home' : 'hero')} />
          </div>
        )}
      </main>
    </div>
  );
}
