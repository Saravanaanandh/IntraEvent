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
  const [story, setStory] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const token = getAdminToken() || '';
  const auth = { Authorization: `Bearer ${token}` };

  async function loadConfigAndStats() {
    try {
      const cRes = await fetch('/api/admin/config', { headers: auth });
      if (cRes.ok) {
        const c = await cRes.json();
        if (c.lieImageUrl) {
          setImageUrl((prev) => (document.activeElement?.tagName === 'INPUT' ? prev : c.lieImageUrl || ''));
          if (document.activeElement?.tagName !== 'INPUT') {
            setTruthLabel(c.truthLabel || '');
            setTruthKeywords((c.truthKeywords || []).join(', '));
            setFalseLabel(c.falseLabel || '');
            setFalseKeywords((c.falseKeywords || []).join(', '));
          }
        }
        setStory((s: any) => s ?? {
          caseTitle: c.caseTitle,
          victim: c.victim,
          storyText: c.storyText,
          publicBrief: c.caseConfig?.publicBrief || '',
          culpritId: c.caseConfig?.culpritId || '',
          suspects: c.caseConfig?.suspects || [],
          clues: c.caseConfig?.clues || [],
        });
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

  async function saveStory() {
    setMsg('');
    const r = await fetch('/api/admin/config/story', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify(story),
    });
    const d = await r.json();
    if (r.ok) soundFX.playSuccess();
    else soundFX.playFail();
    setMsg(r.ok ? '✓ Story / character config updated for Round 2.' : d.error);
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
                      placeholder="e.g. a fresh yellow banana"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-fuchsia-200 uppercase font-semibold">TRUE Keywords (Comma Separated)</label>
                    <input
                      className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs font-code focus:border-fuchsia-400 outline-none text-[#ece9f7]"
                      value={truthKeywords}
                      onChange={(e) => setTruthKeywords(e.target.value)}
                      placeholder="banana, bananas, plantain"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-amber-300 uppercase font-semibold">FALSE Label (AI Insists)</label>
                    <input
                      className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-amber-200/40 text-xs focus:border-amber-200 outline-none text-[#ece9f7]"
                      value={falseLabel}
                      onChange={(e) => setFalseLabel(e.target.value)}
                      placeholder="e.g. a shiny red apple"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-fuchsia-200 uppercase font-semibold">FALSE Keywords (Comma Separated)</label>
                    <input
                      className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs font-code focus:border-fuchsia-400 outline-none text-[#ece9f7]"
                      value={falseKeywords}
                      onChange={(e) => setFalseKeywords(e.target.value)}
                      placeholder="apple, apples"
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

            {/* Round 2 Story & Characters Setup */}
            <div className="rounded-3xl border border-[#4a3670]/70 bg-[#150e28]/90 p-6 shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="font-mono text-xs uppercase tracking-widest text-amber-200 flex items-center gap-2 font-bold">
                  <FileText className="w-4 h-4" /> Control — Round 2 Story &amp; Characters
                </h3>
                <p className="text-[11px] text-[#8f86ad] font-mono mt-1">
                  Edit case title, victim, full story truth (AI internal), public briefing, and culprit ID.
                </p>

                {story && (
                  <div className="space-y-3 mt-4">
                    <div>
                      <label className="text-[11px] font-mono text-amber-200 uppercase font-semibold">Case Title</label>
                      <input
                        className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs focus:border-amber-200 outline-none text-[#ece9f7]"
                        value={story.caseTitle || ''}
                        onChange={(e) => setStory({ ...story, caseTitle: e.target.value })}
                        placeholder="Case title"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-mono text-amber-200 uppercase font-semibold">Victim</label>
                      <input
                        className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs focus:border-amber-200 outline-none text-[#ece9f7]"
                        value={story.victim || ''}
                        onChange={(e) => setStory({ ...story, victim: e.target.value })}
                        placeholder="Victim name"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-mono text-amber-200 uppercase font-semibold">
                        Full Truth (Server / AI Only — Never Shown to Players)
                      </label>
                      <textarea
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs focus:border-amber-200 outline-none text-[#ece9f7]"
                        rows={4}
                        value={story.storyText || ''}
                        onChange={(e) => setStory({ ...story, storyText: e.target.value })}
                        placeholder="Full truth of how the incident unfolded..."
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-mono text-emerald-300 uppercase font-semibold">
                        Public Briefing (Players See This)
                      </label>
                      <textarea
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-[#0a0614] border border-emerald-400/40 text-xs focus:border-emerald-300 outline-none text-[#ece9f7]"
                        rows={3}
                        value={story.publicBrief || ''}
                        onChange={(e) => setStory({ ...story, publicBrief: e.target.value })}
                        placeholder="Public briefing: what happened, when, who was around (no spoilers)"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-mono text-amber-200 uppercase font-semibold">Culprit ID</label>
                      <input
                        className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs focus:border-amber-200 outline-none text-[#ece9f7]"
                        value={story.culpritId || ''}
                        onChange={(e) => setStory({ ...story, culpritId: e.target.value })}
                        placeholder="culpritId (e.g. vicky)"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-2">
                <button
                  onClick={saveStory}
                  className="w-full px-6 py-3 rounded-2xl font-mono font-bold text-xs bg-gradient-to-r from-amber-300 to-yellow-200 text-[#241a05] cursor-pointer hover:brightness-110 transition-all shadow-lg"
                >
                  SAVE STORY
                </button>
                <p className="text-[10px] text-[#5f5585] font-mono text-center">
                  Advanced suspect schema update via: PUT /api/admin/config/story
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
