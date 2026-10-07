import { useEffect, useState } from 'react';
import { Shield, Image as ImageIcon, FileText, RotateCcw, LogOut, SlidersHorizontal, Trophy } from 'lucide-react';
import { getAdminToken } from '../utils/storage';
import { soundFX } from '../utils/audio';
import Leaderboard from './Leaderboard';

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'controls' | 'leaderboard'>('controls');
  const [participantCount, setParticipantCount] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const [truthLabel, setTruthLabel] = useState('');
  const [truthKeywords, setTruthKeywords] = useState('');
  const [falseLabel, setFalseLabel] = useState('');
  const [falseKeywords, setFalseKeywords] = useState('');
  const [stories, setStories] = useState<any[]>([]);
  const [activeStoryId, setActiveStoryId] = useState('');
  const [keyPool, setKeyPool] = useState<{ total: number; assigned: number } | null>(null);
  const [msg, setMsg] = useState('');

  const token = getAdminToken() || '';
  const auth = { Authorization: `Bearer ${token}` };

  async function loadConfigAndStats() {
    try {
      const cRes = await fetch('/api/admin/config', { headers: auth });
      if (cRes.ok) {
        const c = await cRes.json();
        if (document.activeElement?.tagName !== 'INPUT') {
          setImageUrl(c.lieImageUrl || '');
          setTruthLabel(c.truthLabel || '');
          setTruthKeywords((c.truthKeywords || []).join(', '));
          setFalseLabel(c.falseLabel || '');
          setFalseKeywords((c.falseKeywords || []).join(', '));
        }
        setStories(c.stories || []);
        setActiveStoryId(c.activeStoryId || '');
        if (c.keyPool) setKeyPool(c.keyPool);
      }

      const lRes = await fetch('/api/leaderboard', { headers: auth });
      if (lRes.ok) {
        const l = await lRes.json();
        setParticipantCount((l.leaderboard || []).length);
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadConfigAndStats();
    const es = new EventSource(`/api/realtime/stream?token=${encodeURIComponent(token)}`);
    es.addEventListener('leaderboard_updated', loadConfigAndStats);
    es.addEventListener('players_updated', loadConfigAndStats);
    es.onerror = () => {
      try {
        es.close();
      } catch {
        /* ignore */
      }
    };
    const t = setInterval(loadConfigAndStats, 4000);
    return () => {
      es.close();
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveImage() {
    setMsg('');
    const r = await fetch('/api/admin/config/lie-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ imageUrl, truthLabel, truthKeywords, falseLabel, falseKeywords }),
    });
    const d = await r.json();
    if (r.ok) soundFX.playSuccess();
    else soundFX.playFail();
    setMsg(r.ok ? `✓ Ctrl+Lie config updated — insist "${d.falseLabel}", admit "${d.truthLabel}".` : d.error);
  }

  async function selectStory(id: string) {
    setMsg('');
    const r = await fetch('/api/admin/config/story-select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ storyId: id }),
    });
    const d = await r.json();
    if (r.ok) {
      soundFX.playSuccess();
      setActiveStoryId(d.activeStoryId);
      const title = (stories.find((s: any) => s.id === d.activeStoryId)?.caseTitle) || d.activeStoryId;
      setMsg(`✓ Round 2 story switched — "${title}". Suspects, clues, culprit and AI briefing updated together.`);
    } else {
      soundFX.playFail();
      setMsg(d.error);
    }
    loadConfigAndStats();
  }

  async function resetAll() {
    if (!confirm('Are you sure? This will wipe all participants, chat transcripts, and recorded scores.')) return;
    await fetch('/api/admin/reset', { method: 'POST', headers: auth });
    soundFX.playFail();
    loadConfigAndStats();
  }

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4 space-y-5 animate-fadeIn select-none min-h-screen flex flex-col">
      {/* Top Verdict Chamber Bar */}
      <div className="rounded-3xl bg-amber-300/5 border border-amber-200/30 p-5 flex items-center justify-between gap-3 glow-verdict flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-[#1d1440] border border-amber-200/40 flex items-center justify-center">
            <Shield className="w-6 h-6 text-amber-200" />
          </span>
          <div>
            <h2 className="font-dossier font-extrabold text-xl leading-none">VERDICT CHAMBER</h2>
            <p className="label-gold mt-1 text-xs">
              admin@gces.in · <span className="text-emerald-300">● realtime</span> · {participantCount} investigators · final /100
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="px-4 py-2.5 rounded-xl font-mono text-xs bg-[#241a45] hover:bg-red-950/60 border border-[#4a3670]/70 hover:border-red-400/50 text-[#d9d2f2] hover:text-red-200 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> LOGOUT
        </button>
      </div>

      {/* Two Tabs at Top: "Event controls" and "Leaderboard" */}
      <div className="flex items-center gap-3 border-b border-[#4a3670]/50 pb-3">
        <button
          id="tab-event-controls"
          onClick={() => {
            soundFX.playClick();
            setActiveTab('controls');
          }}
          className={`px-5 py-2.5 rounded-2xl font-mono text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'controls'
              ? 'bg-gradient-to-r from-amber-300 to-yellow-400 text-[#241a05] shadow-lg shadow-amber-300/20 font-extrabold'
              : 'bg-[#150e28]/90 text-[#8f86ad] hover:text-white border border-[#4a3670]/60'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" /> Event controls
        </button>
        <button
          id="tab-leaderboard"
          onClick={() => {
            soundFX.playClick();
            setActiveTab('leaderboard');
          }}
          className={`px-5 py-2.5 rounded-2xl font-mono text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'leaderboard'
              ? 'bg-gradient-to-r from-amber-300 to-yellow-400 text-[#241a05] shadow-lg shadow-amber-300/20 font-extrabold'
              : 'bg-[#150e28]/90 text-[#8f86ad] hover:text-white border border-[#4a3670]/60'
          }`}
        >
          <Trophy className="w-4 h-4" /> Leaderboard
        </button>
      </div>

      {/* Notification Toast Message */}
      {msg && (
        <div className="text-xs font-mono bg-emerald-500/10 border border-emerald-400/40 text-emerald-200 rounded-2xl px-4 py-2.5 animate-fadeIn">
          {msg}
        </div>
      )}

      {/* Tab 1: Event Controls — Full Width & Height */}
      {activeTab === 'controls' && (
        <div className="w-full flex-1 flex flex-col justify-between space-y-6 animate-fadeIn">
          <div className="grid lg:grid-cols-2 gap-6 flex-1">
            {/* Round 1 Ctrl+Lie Setup */}
            <div className="rounded-3xl panel-tribunal border-fuchsia-400/30 p-6 shadow-xl glow-arena flex flex-col justify-between">
              <div>
                <h3 className="font-mono text-xs uppercase tracking-widest text-fuchsia-300 flex items-center gap-2 font-bold">
                  <ImageIcon className="w-4 h-4" /> Control — Round 1 Ctrl+Lie Setup
                </h3>
                <p className="text-[11px] text-[#8f86ad] font-mono mt-1">
                  Image + TRUE content (player wins by admitting it) + FALSE label (AI stubbornly insists on it).
                </p>
                {keyPool && (
                  <p className="text-[11px] text-emerald-300 font-mono mt-1">
                    Shared AI pool: {keyPool.assigned}/{keyPool.total} keys assigned — participants log in with name + regno only.
                  </p>
                )}

                <div className="space-y-3 mt-4">
                  <div>
                    <label className="text-[11px] font-mono text-fuchsia-200 uppercase font-semibold">Image URL</label>
                    <input
                      className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs font-code focus:border-fuchsia-400 outline-none text-[#ece9f7]"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://… image url"
                    />
                  </div>

                  {imageUrl && (
                    <div className="relative rounded-2xl overflow-hidden border border-fuchsia-400/40 max-h-48 flex items-center justify-center bg-black">
                      <img src={imageUrl} className="w-full max-h-48 object-cover" alt="round 1 preview" />
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] font-mono text-emerald-300 uppercase font-semibold">TRUE Label</label>
                    <input
                      className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-emerald-400/40 text-xs focus:border-emerald-300 outline-none text-[#ece9f7]"
                      value={truthLabel}
                      onChange={(e) => setTruthLabel(e.target.value)}
                      placeholder="e.g. a cute white cat"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-fuchsia-200 uppercase font-semibold">TRUE Keywords (Comma Separated)</label>
                    <input
                      className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs font-code focus:border-fuchsia-400 outline-none text-[#ece9f7]"
                      value={truthKeywords}
                      onChange={(e) => setTruthKeywords(e.target.value)}
                      placeholder="cat, cats, kitten"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-amber-300 uppercase font-semibold">FALSE Label (AI Insists)</label>
                    <input
                      className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-amber-200/40 text-xs focus:border-amber-200 outline-none text-[#ece9f7]"
                      value={falseLabel}
                      onChange={(e) => setFalseLabel(e.target.value)}
                      placeholder="e.g. a cute white dog"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-fuchsia-200 uppercase font-semibold">FALSE Keywords (Comma Separated)</label>
                    <input
                      className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs font-code focus:border-fuchsia-400 outline-none text-[#ece9f7]"
                      value={falseKeywords}
                      onChange={(e) => setFalseKeywords(e.target.value)}
                      placeholder="dog, dogs, puppy"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={saveImage}
                className="mt-6 w-full px-6 py-3 rounded-xl font-mono font-bold text-xs btn-tribunal cursor-pointer transition-all shadow-lg"
              >
                SAVE CTRL+LIE SETUP
              </button>
            </div>

            {/* Round 2 Story Selector — one story per batch */}
            <div className="rounded-3xl border border-[#4a3670]/70 bg-[#150e28]/90 p-6 shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="font-mono text-xs uppercase tracking-widest text-amber-200 flex items-center gap-2 font-bold">
                  <FileText className="w-4 h-4" /> Control — Round 2 Story (one per batch)
                </h3>
                <p className="text-[11px] text-[#8f86ad] font-mono mt-1">
                  Select the story for the current batch. Characters, clues, culprit and AI briefing switch together.
                </p>

                <div className="space-y-3 mt-4">
                  {stories.map((s: any) => {
                    const active = s.id === activeStoryId;
                    return (
                      <div
                        key={s.id}
                        className={`rounded-2xl border p-4 transition-all ${
                          active
                            ? 'border-emerald-400/60 bg-emerald-500/10 shadow-lg'
                            : 'border-[#4a3670]/60 bg-[#0a0614] hover:border-amber-200/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f86ad]">
                              {s.batchLabel}
                            </div>
                            <div className="font-dossier font-bold text-sm text-white mt-0.5">
                              {s.caseTitle}
                            </div>
                            <div className="text-[11px] text-[#8f86ad] font-mono mt-0.5">
                              Victim: {s.victim}
                            </div>
                            <div className="text-[11px] text-[#8f86ad] font-mono mt-0.5">
                              {(s.suspects || []).map((x: any) => x.name).join(' · ')} — {s.clueCount} clues — culprit: {s.culpritId}
                            </div>
                          </div>
                          {active ? (
                            <span className="font-mono text-[10px] font-bold px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300">
                              ✓ LIVE NOW
                            </span>
                          ) : (
                            <button
                              onClick={() => selectStory(s.id)}
                              className="font-mono text-[11px] font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-200 text-[#241a05] hover:brightness-110 cursor-pointer transition-all"
                            >
                              SELECT FOR BATCH
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!stories.length && (
                    <p className="text-[11px] text-[#8f86ad] font-mono">Loading stories…</p>
                  )}
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <p className="text-[10px] text-[#5f5585] font-mono text-center">
                  Switching stories restarts unfinished Round-2 sessions on the new case automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Reset Tribunal Button */}
          <div className="pt-2">
            <button
              onClick={resetAll}
              className="w-full px-6 py-3.5 rounded-2xl font-mono text-xs bg-red-950/40 border border-red-400/40 text-red-300 hover:bg-red-950/70 hover:border-red-400 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg"
            >
              <RotateCcw className="w-4 h-4" /> RESET TRIBUNAL (CLEAR ALL PARTICIPANTS &amp; SCORES)
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Leaderboard — Top 3 Performers + Remaining Paginated with Search */}
      {activeTab === 'leaderboard' && (
        <div className="w-full flex-1 animate-fadeIn">
          <Leaderboard live token={token} />
        </div>
      )}
    </div>
  );
}
