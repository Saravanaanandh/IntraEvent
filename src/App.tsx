import { useState } from 'react';
import { Zap, Shield, UserCheck, Image as ImageIcon, MessagesSquare, Search, Award, ChevronRight, BookOpen, ScrollText } from 'lucide-react';
import Navbar, { type NavView } from './components/Navbar';
import Footer from './components/Footer';
import ParticipantLogin from './views/ParticipantLogin';
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

export type View = 'landing' | 'plogin' | 'alogin' | 'home' | 'lie' | 'lieresult' | 'detective' | 'thankyou' | 'rules' | 'admin';

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [participant, setParticipant] = useState<Participant | null>(() => getStoredParticipant());
  const [isAdmin, setIsAdmin] = useState(() => !!getAdminToken());
  const [soundOn, setSoundOn] = useState(true);

  function logoutParticipant() {
    clearAllCookiesAndStorage();
    setParticipant(null);
    setView('landing');
  }

  function logoutAdmin() {
    clearAdminToken();
    setIsAdmin(false);
    setView('landing');
  }

  function navGo(v: NavView) {
    if (v === 'landing') { setView(participant ? 'home' : 'landing'); return; }
    if (v === 'home') {
      if (participant) setView('home');
      else setView('plogin');
      return;
    }
    if (v === 'lie' || v === 'detective') {
      if (!participant) { setView('plogin'); return; }
      // Completed rounds open read-only (view chats, no new messages).
      if (v === 'detective' && !participant.round1Completed) { setView('home'); return; }
      setView(v);
      return;
    }
    if (v === 'admin') {
      setView(isAdmin ? 'admin' : 'alogin');
      return;
    }
    setView(v);
  }

  const whoLabel = participant
    ? `${participant.name} · ${participant.registerNo}`
    : isAdmin
      ? 'admin@gces.in'
      : null;

  return (
    <div className="min-h-screen bg-[#0a0614] text-[#ece9f7] flex flex-col font-sans selection:bg-fuchsia-500 selection:text-white bg-grid-pattern">
      <Navbar
        current={view === 'plogin' ? 'home' : view === 'alogin' ? 'admin' : view}
        go={navGo}
        whoLabel={whoLabel}
        isParticipant={!!participant}
        soundOn={soundOn}
        onToggleSound={() => setSoundOn(soundFX.toggleSound())}
      />

      <main className="flex-1">
        {view === 'landing' && (
          <div className="animate-fadeIn">
            <div className="relative pt-12 sm:pt-20 pb-16 overflow-hidden">
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[620px] h-[360px] bg-gradient-to-tr from-violet-700/25 via-fuchsia-600/15 to-amber-500/10 blur-[120px] rounded-full pointer-events-none" />
              <div className="absolute top-24 right-8 w-72 h-72 bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />
              <div className="absolute inset-0 bg-dot-matrix opacity-60 pointer-events-none" />

              <div className="relative max-w-5xl mx-auto px-4 text-center space-y-8">
                <div className="inline-flex px-3.5 py-1.5 rounded-full bg-[#150e28]/90 border border-[#6b4fa8]/60 label-gold items-center gap-2">
                  <span className="relative flex w-2 h-2">
                    <span className="absolute w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                    <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                  </span>
                  INTRA-COLLEGE COMBINED EVENT · LIVE · VERDICT OUT OF 100
                </div>

                <div className="space-y-3">
                  <div className="font-code font-bold tracking-[0.35em] text-xs sm:text-sm text-fuchsia-300">
                    PERSUASION × DEDUCTION
                  </div>
                  <h1 className="font-display font-black text-4xl sm:text-6xl md:text-7xl tracking-wider leading-tight title-tribunal">
                    MIDNIGHT TRIBUNAL
                  </h1>
                  <div className="font-dossier font-extrabold text-xl sm:text-3xl text-[#ece9f7] tracking-wide">
                    Ctrl+Lie <span className="text-amber-200">+</span> The Hidden Mystery
                  </div>
                  <p className="font-type italic text-emerald-300/80 text-sm sm:text-base">
                    "First bend the machine's mind — then, at 9:42 PM, the lights went out…"
                  </p>
                </div>

                <div className="inline-block font-mono font-black tracking-widest px-5 py-2.5 rounded-xl bg-[#1d1440]/90 border-2 border-[#6b4fa8]/70 text-amber-200 shadow-xl text-xs sm:text-sm glow-verdict">
                  ROUND 1: PERSUADE THE MACHINE → ROUND 2: CATCH THE KILLER
                </div>

                <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
                  <button
                    onClick={() => { soundFX.playClick(); participant ? setView('home') : setView('plogin'); }}
                    className="group p-6 rounded-3xl panel-tribunal hover:border-fuchsia-400/60 shadow-xl glow-arena text-left transform hover:-translate-y-0.5 transition-all"
                  >
                    <div className="label-gold flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-fuchsia-300" /> Investigator Enrollment
                    </div>
                    <div className="font-display font-black text-xl mt-2">PARTICIPANT LOGIN</div>
                    <p className="text-xs text-[#8f86ad] mt-1 font-mono">Name + Register No → chat with AI → submit → done</p>
                    <span className="inline-flex items-center gap-1 mt-3 font-mono text-xs text-amber-200">
                      Enter the tribunal <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-all" />
                    </span>
                  </button>
                  <button
                    onClick={() => { soundFX.playClick(); isAdmin ? setView('admin') : setView('alogin'); }}
                    className="group p-6 rounded-3xl panel-tribunal hover:border-amber-300/50 shadow-xl text-left transform hover:-translate-y-0.5 transition-all"
                  >
                    <div className="label-gold flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-amber-200" /> Chief Event Controller
                    </div>
                    <div className="font-dossier font-extrabold text-xl mt-2">ADMIN LOGIN</div>
                    <p className="text-xs text-[#8f86ad] mt-1 font-mono">Scores /100 · realtime verdicts · arena controls</p>
                    <span className="inline-flex items-center gap-1 mt-3 font-mono text-xs text-emerald-300">
                      Open the verdict chamber <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-all" />
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                  {[
                    { icon: ImageIcon, tint: 'text-amber-200 border-amber-300/30 bg-amber-400/5', label: '1 IMAGE', sub: 'the visual truth' },
                    { icon: MessagesSquare, tint: 'text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-400/5', label: '30 MIN', sub: 'open chat' },
                    { icon: Search, tint: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/5', label: '4 SUSPECTS', sub: 'forensic clues' },
                    { icon: Award, tint: 'text-violet-300 border-violet-400/30 bg-violet-400/5', label: '100 POINTS', sub: 'one final verdict' },
                  ].map((p) => {
                    const Icon = p.icon;
                    return (
                      <div key={p.label} className={`p-4 rounded-2xl bg-[#150e28]/85 border ${p.tint.split(' ').slice(1).join(' ')}`}>
                        <Icon className={`w-5 h-5 ${p.tint.split(' ')[0]}`} />
                        <div className="font-display font-black text-sm mt-2 tracking-wider">{p.label}</div>
                        <div className="font-mono text-[11px] text-[#8f86ad] mt-0.5">{p.sub}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => { soundFX.playClick(); participant ? setView('home') : setView('plogin'); }}
                    className="px-8 py-4 rounded-xl font-mono font-bold text-sm btn-tribunal flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
                  >
                    <Zap className="w-4 h-4" /> START AS PARTICIPANT
                  </button>
                  <button
                    onClick={() => { soundFX.playClick(); setView('rules'); }}
                    className="px-8 py-4 rounded-xl font-mono font-bold text-sm bg-[#150e28]/90 hover:bg-[#1d1440] border border-[#4a3670]/80 hover:border-amber-200/50 text-[#d9d2f2] flex items-center justify-center gap-2 transform hover:-translate-y-0.5 transition-all"
                  >
                    <BookOpen className="w-4 h-4 text-amber-200" /> HOW IT WORKS
                  </button>
                </div>

                <p className="font-mono text-[11px] text-[#5f5585] flex items-center justify-center gap-1.5">
                  <ScrollText className="w-3.5 h-3.5" /> Participants: chat with the AI, submit your solution — the tribunal declares ranks. No scoreboards on your side.
                </p>
              </div>
            </div>
          </div>
        )}

        {view === 'plogin' && (
          <ParticipantLogin
            onLogin={(p) => { soundFX.playSuccess(); setParticipant(p); setView('home'); }}
            onBack={() => setView('landing')}
          />
        )}
        {view === 'alogin' && (
          <AdminLogin onLogin={() => { soundFX.playSuccess(); setIsAdmin(true); setView('admin'); }} onBack={() => setView('landing')} />
        )}

        {view === 'home' && participant && (
          <Home
            participant={participant}
            onStartLie={() => { soundFX.playClick(); void enterFullscreen(); setView('lie'); }}
            onStartDetective={() => { soundFX.playClick(); void enterFullscreen(); setView('detective'); }}
            onRules={() => { soundFX.playClick(); setView('rules'); }}
            onLogout={() => { soundFX.playFail(); logoutParticipant(); }}
          />
        )}

        {view === 'lie' && participant && (
          <LieArena participant={participant} readOnly={participant.round1Completed} onFinish={(p) => { soundFX.playSuccess(); setParticipant(p); setView('lieresult'); }} onExit={() => setView('home')} />
        )}

        {view === 'lieresult' && participant && (
          <div className="max-w-md mx-auto mt-10 p-8 rounded-3xl panel-tribunal border-2 border-fuchsia-400/40 shadow-2xl glow-arena text-center animate-fadeIn">
            <div className="label-gold">Round 1 · Trial Sealed</div>
            <h2 className="font-display font-black text-2xl mt-2 tracking-wider">ROUND 1 COMPLETE</h2>
            <p className="text-xs text-[#8f86ad] mt-2 font-mono leading-relaxed">
              Your persuasion run has been recorded and sealed by the tribunal.
              Round 2 — The Hidden Mystery — is now unlocked.
            </p>
            <button onClick={() => { soundFX.playClick(); void enterFullscreen(); setView('detective'); }} className="mt-5 w-full px-6 py-3.5 rounded-2xl font-mono font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-[#06110c] hover:brightness-110 transition-all glow-live">
              OPEN ROUND 2 →
            </button>
            <button onClick={() => setView('home')} className="mt-2 w-full px-6 py-3 rounded-2xl font-mono text-xs bg-[#150e28] hover:bg-[#1d1440] border border-[#4a3670]/70 text-[#d9d2f2]">
              Back to Base
            </button>
          </div>
        )}

        {view === 'detective' && participant && (
          <DetectiveGame participant={participant} readOnly={participant.round2Completed} onDone={(p) => { soundFX.playSuccess(); setParticipant(p); setView('thankyou'); }} onExit={() => setView('home')} />
        )}

        {view === 'thankyou' && participant && (
          <div className="relative max-w-md mx-auto mt-16 p-8 rounded-3xl panel-tribunal shadow-2xl glow-verdict text-center animate-fadeIn overflow-hidden">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-48 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="relative">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-[#1d1440] border border-amber-200/40 flex items-center justify-center">
                <Award className="w-7 h-7 text-amber-200" />
              </div>
              <div className="label-gold mt-3">Both trials sealed</div>
              <h2 className="font-dossier font-extrabold text-2xl mt-1">Thank you for participating!</h2>
              <p className="font-type italic text-[#8f86ad] text-sm mt-1">Wait for the final result.</p>
              <button
                onClick={() => {
                  fetch('/api/participant/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: participant.name, registerNo: participant.registerNo }) }).catch(() => {});
                  soundFX.playClick();
                  clearAllCookiesAndStorage();
                  setParticipant(null);
                  setView('landing');
                }}
                className="mt-5 w-full px-6 py-3 rounded-xl font-mono font-bold text-sm btn-tribunal"
              >
                BACK TO HOME (CLEARS SESSION)
              </button>
            </div>
          </div>
        )}

        {view === 'rules' && <RulesView onBack={() => setView(participant ? 'home' : 'landing')} />}

        {/* Admin chamber is hard-guarded: participants can never render it. */}
        {view === 'admin' && (isAdmin
          ? <AdminDashboard onLogout={() => { soundFX.playClick(); logoutAdmin(); }} />
          : <AdminLogin onLogin={() => { soundFX.playSuccess(); setIsAdmin(true); setView('admin'); }} onBack={() => setView('landing')} />)}
      </main>

      {view !== 'admin' && <Footer />}
    </div>
  );
}
