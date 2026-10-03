import { useEffect, useState } from 'react';
import { Shield, Users, Image as ImageIcon, FileText, RotateCcw, LogOut } from 'lucide-react';
import { getAdminToken } from '../utils/storage';
import { soundFX } from '../utils/audio';
import Leaderboard from './Leaderboard';

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [parts, setParts] = useState<any[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [truthLabel, setTruthLabel] = useState('');
  const [truthKeywords, setTruthKeywords] = useState('');
  const [falseLabel, setFalseLabel] = useState('');
  const [falseKeywords, setFalseKeywords] = useState('');
  const [story, setStory] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const token = getAdminToken() || '';
  const auth = { Authorization: `Bearer ${token}` };

  async function load() {
    const r = await fetch('/api/admin/participants', { headers: auth });
    const d = await r.json();
    if (r.ok) setParts(d.participants || []);
    const c = await (await fetch('/api/admin/config', { headers: auth })).json();
    if (c.lieImageUrl) {
      setImageUrl((prev) => (document.activeElement?.tagName === 'INPUT' ? prev : c.lieImageUrl || ''));
      if (document.activeElement?.tagName !== 'INPUT') {
        setTruthLabel(c.truthLabel || '');
        setTruthKeywords((c.truthKeywords || []).join(', '));
        setFalseLabel(c.falseLabel || '');
        setFalseKeywords((c.falseKeywords || []).join(', '));
      }
    }
    setStory((s: any) => s ?? { caseTitle: c.caseTitle, victim: c.victim, storyText: c.storyText, culpritId: '', suspects: [], clues: [] });
  }

  useEffect(() => {
    load();
    const es = new EventSource(`/api/realtime/stream?token=${encodeURIComponent(token)}`);
    es.addEventListener('leaderboard_updated', load);
    es.addEventListener('players_updated', load);
    const t = setInterval(load, 4000);
    return () => { es.close(); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveImage() {
    setMsg('');
    const r = await fetch('/api/admin/config/lie-image', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ imageUrl, truthLabel, truthKeywords, falseLabel, falseKeywords }) });
    const d = await r.json();
    if (r.ok) soundFX.playSuccess(); else soundFX.playFail();
    setMsg(r.ok ? `✓ Ctrl+Lie config updated — insist "${d.falseLabel}", admit "${d.truthLabel}".` : d.error);
  }

  async function saveStory() {
    setMsg('');
    const r = await fetch('/api/admin/config/story', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(story) });
    const d = await r.json();
    if (r.ok) soundFX.playSuccess(); else soundFX.playFail();
    setMsg(r.ok ? '✓ Story / character config updated for Round 2.' : d.error);
  }

  async function resetAll() {
    if (!confirm('Reset all participants & scores?')) return;
    await fetch('/api/admin/reset', { method: 'POST', headers: auth });
    soundFX.playFail();
    load();
  }

  return (
    <div className="max-w-5xl mx-auto mt-6 px-4 space-y-4 animate-fadeIn select-none">
      <div className="rounded-3xl bg-amber-300/5 border border-amber-200/30 p-5 flex items-center justify-between gap-3 glow-verdict flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-[#1d1440] border border-amber-200/40 flex items-center justify-center">
            <Shield className="w-6 h-6 text-amber-200" />
          </span>
          <div>
            <h2 className="font-dossier font-extrabold text-xl leading-none">VERDICT CHAMBER</h2>
            <p className="label-gold mt-1">admin@gces.in · <span className="text-emerald-300">● realtime</span> · {parts.length} investigators · final /100</p>
          </div>
        </div>
        <button onClick={onLogout} className="px-4 py-2.5 rounded-xl font-mono text-xs bg-[#241a45] hover:bg-red-950/60 border border-[#4a3670]/70 hover:border-red-400/50 text-[#d9d2f2] hover:text-red-200 flex items-center gap-1.5 transition-all">
          <LogOut className="w-4 h-4" /> LOGOUT
        </button>
      </div>

      {msg && <div className="text-xs font-mono bg-emerald-500/10 border border-emerald-400/40 text-emerald-200 rounded-2xl px-4 py-2.5 animate-fadeIn">{msg}</div>}

      <div className="rounded-3xl border border-[#4a3670]/70 bg-[#150e28]/90 p-6">
        <h3 className="font-mono text-xs uppercase tracking-widest text-[#cfc8ea] flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-300" /> Participants Details &amp; Scores ({parts.length})
        </h3>
        <div className="overflow-x-auto mt-3 rounded-2xl border border-[#4a3670]/60 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0a0614]/80 uppercase font-mono text-[11px] text-[#8f86ad] text-left">
                <th className="px-4 py-3">Investigator</th>
                <th className="px-4 py-3">Reg No</th>
                <th className="px-4 py-3">R1/500</th>
                <th className="px-4 py-3">R2/100</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Focus</th>
                <th className="px-4 py-3 text-right">Final/100</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4a3670]/40">
              {parts.map((p) => {
                const pct = Math.min(100, Math.round(((p.totalScore || 0) / 100) * 100));
                return (
                  <tr key={p.id} className="hover:bg-[#1d1440]/60">
                    <td className="px-4 py-2.5 font-semibold">{p.name}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[#8f86ad]">{p.registerNo}</td>
                    <td className="px-4 py-2.5 font-mono text-fuchsia-300">{p.round1Completed ? p.round1Score : '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-emerald-300">{p.round2Completed ? p.round2Score : '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-[#241a45] h-2 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-violet-500 via-fuchsia-400 to-amber-300 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${p.round2Completed ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/40' : p.round1Completed ? 'bg-amber-300/10 text-amber-200 border border-amber-200/40' : 'bg-[#0a0614] text-[#8f86ad] border border-[#4a3670]'}`}>
                          {p.round2Completed ? 'Sealed' : p.round1Completed ? 'R2 open' : 'R1'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px]">{((p.violations && (p.violations.tabHidden + p.violations.fullscreenExit)) > 0) ? <span className="text-red-300">{p.violations.tabHidden || 0}T/{p.violations.fullscreenExit || 0}F</span> : <span className="text-[#5f5585]">clean</span>}</td>
                    <td className="px-4 py-2.5 text-right font-display font-black text-amber-200">{p.totalScore}</td>
                  </tr>
                );
              })}
              {!parts.length && <tr><td colSpan={7} className="text-center text-[#8f86ad] font-mono text-xs py-5">No investigators enrolled yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Leaderboard live token={token} />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-3xl panel-tribunal border-fuchsia-400/30 p-6 shadow-xl glow-arena">
          <h3 className="font-mono text-xs uppercase tracking-widest text-fuchsia-300 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" /> Control — Round 1 Ctrl+Lie Setup
          </h3>
          <p className="text-[11px] text-[#8f86ad] font-mono mt-1">Image + TRUE content (win by admitting it) + FALSE label (AI insists on it).</p>
          <input className="w-full mt-2 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs font-code focus:border-fuchsia-400 outline-none text-[#ece9f7]" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://… image url" />
          {imageUrl && <img src={imageUrl} className="w-full max-h-40 object-cover rounded-2xl mt-2 border border-fuchsia-400/40" alt="preview" />}
          <input className="w-full mt-2 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-emerald-400/40 text-xs focus:border-emerald-300 outline-none text-[#ece9f7]" value={truthLabel} onChange={(e) => setTruthLabel(e.target.value)} placeholder="TRUE label — what image really shows, e.g. a fresh yellow banana" />
          <input className="w-full mt-2 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs font-code focus:border-fuchsia-400 outline-none text-[#ece9f7]" value={truthKeywords} onChange={(e) => setTruthKeywords(e.target.value)} placeholder="TRUE keywords, comma separated, e.g. banana, bananas" />
          <input className="w-full mt-2 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-amber-200/40 text-xs focus:border-amber-200 outline-none text-[#ece9f7]" value={falseLabel} onChange={(e) => setFalseLabel(e.target.value)} placeholder="FALSE label — AI must insist, e.g. a shiny red apple" />
          <input className="w-full mt-2 px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs font-code focus:border-fuchsia-400 outline-none text-[#ece9f7]" value={falseKeywords} onChange={(e) => setFalseKeywords(e.target.value)} placeholder="FALSE keywords, comma separated, e.g. apple, apples" />
          <button onClick={saveImage} className="mt-2 w-full px-6 py-3 rounded-xl font-mono font-bold text-xs btn-tribunal">SAVE CTRL+LIE SETUP</button>
        </div>
        <div className="rounded-3xl border border-[#4a3670]/70 bg-[#150e28]/90 p-6">
          <h3 className="font-mono text-xs uppercase tracking-widest text-amber-200 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Control — Round 2 Story &amp; Characters
          </h3>
          <p className="text-[11px] text-[#8f86ad] font-mono mt-1">Edit case title, victim, story text, culprit id.</p>
          {story && (
            <div className="space-y-2 mt-2">
              <input className="w-full px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs focus:border-amber-200 outline-none text-[#ece9f7]" value={story.caseTitle || ''} onChange={(e) => setStory({ ...story, caseTitle: e.target.value })} placeholder="Case title" />
              <input className="w-full px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs focus:border-amber-200 outline-none text-[#ece9f7]" value={story.victim || ''} onChange={(e) => setStory({ ...story, victim: e.target.value })} placeholder="Victim" />
              <textarea className="w-full px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs focus:border-amber-200 outline-none text-[#ece9f7]" rows={4} value={story.storyText || ''} onChange={(e) => setStory({ ...story, storyText: e.target.value })} placeholder="Story text" />
              <input className="w-full px-3 py-2.5 rounded-xl bg-[#0a0614] border border-[#4a3670]/70 text-xs focus:border-amber-200 outline-none text-[#ece9f7]" value={story.culpritId || ''} onChange={(e) => setStory({ ...story, culpritId: e.target.value })} placeholder="culpritId (e.g. vicky)" />
              <button onClick={saveStory} className="w-full px-6 py-3 rounded-2xl font-mono font-bold text-xs bg-gradient-to-r from-amber-300 to-yellow-200 text-[#241a05]">SAVE STORY</button>
              <p className="text-[11px] text-[#5f5585] font-mono">Full characters/clues JSON via: PUT /api/admin/config/story {'{suspects:[{id,name,role,personality,relationship,alibi,trueKnowledge,isGuilty,guiltyMotive,guiltyFlaw,innocentSecret,gatedClues:[{clue,trigger}]}], clues:[...]}'}</p>
            </div>
          )}
        </div>
      </div>

      <button onClick={resetAll} className="w-full px-6 py-3.5 rounded-2xl font-mono text-xs bg-red-950/40 border border-red-400/40 text-red-300 hover:bg-red-950/70 flex items-center justify-center gap-2">
        <RotateCcw className="w-4 h-4" /> RESET TRIBUNAL (CLEAR ALL PARTICIPANTS &amp; SCORES)
      </button>
    </div>
  );
}
