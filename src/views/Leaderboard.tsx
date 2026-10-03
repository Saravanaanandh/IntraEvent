import { useEffect, useState } from 'react';
import { Trophy, Gavel } from 'lucide-react';

/** ADMIN ONLY — participants never see ranks or scores. All fetches carry the admin token. */
export default function Leaderboard({ live = false, token = '' }: { live?: boolean; token?: string }) {
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    const r = await fetch('/api/leaderboard', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!r.ok) { setRows([]); return; }
    const d = await r.json();
    setRows(d.leaderboard || []);
  }

  useEffect(() => {
    load();
    if (!live) return;
    const es = new EventSource(`/api/realtime/stream?token=${encodeURIComponent(token)}`);
    es.addEventListener('leaderboard_updated', (e: any) => {
      try { setRows(JSON.parse(e.data).leaderboard || []); } catch { /* keep polling copy */ }
    });
    // Serverless hosts can't hold SSE streams — close on any error and rely on polling.
    es.onerror = () => { try { es.close(); } catch { /* ignore */ } };
    const t = setInterval(load, 3000);
    return () => { es.close(); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="max-w-4xl mx-auto mt-6 px-4 animate-fadeIn">
      <div className="text-center">
        <div className="inline-flex px-3.5 py-1.5 rounded-full bg-[#150e28]/90 border border-amber-200/30 label-gold items-center gap-2">
          <Trophy className="w-3.5 h-3.5" /> VERDICT HALL · FINAL SCORE OUT OF 100
          {live && <span className="flex items-center gap-1 text-emerald-300"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /> LIVE</span>}
        </div>
        <h2 className="font-display font-black text-3xl mt-2 tracking-wider title-tribunal">
          LEADERBOARD
        </h2>
        <p className="font-mono text-[11px] text-[#8f86ad] mt-1">Final = (Round 1 raw + Round 2 raw) ÷ 6 · admin eyes only</p>
      </div>

      {top3.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-3 mt-5 items-end">
          {top3.map((r, i) => (
            <div
              key={r.participantId}
              className={`p-5 rounded-3xl text-center border-2 shadow-xl ${i === 0 ? 'border-amber-200/50 bg-gradient-to-b from-amber-400/15 via-[#150e28] to-[#150e28] sm:-translate-y-2 glow-verdict' : 'border-[#4a3670]/70 bg-[#150e28]/90'}`}
            >
              <div className={`inline-block px-3 py-1 rounded-full font-mono text-[11px] font-bold ${i === 0 ? 'bg-amber-300 text-[#241a05]' : i === 1 ? 'bg-[#3d2c63] text-[#d9d2f2]' : 'bg-amber-900/60 text-amber-200'}`}>
                {i === 0 ? '👑 1st Place' : i === 1 ? '🥈 2nd Place' : '🥉 3rd Place'}
              </div>
              <div className="font-bold mt-2 truncate">{r.name}</div>
              <div className="font-mono text-[11px] text-[#8f86ad]">{r.registerNo}</div>
              <div className="font-display font-black text-3xl mt-1 title-tribunal">{r.totalScore}<span className="text-sm">/100</span></div>
              <div className="font-mono text-[10px] text-[#8f86ad] mt-1">R1 {r.round1Completed ? r.round1Score : '—'}/500 · R2 {r.round2Completed ? r.round2Score : '—'}/100</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-3xl border border-[#4a3670]/70 bg-[#150e28]/90 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0a0614] border-b border-[#4a3670]/60 text-[11px] uppercase font-mono text-[#8f86ad] text-left">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Participant</th>
              <th className="px-4 py-3">R1/500</th>
              <th className="px-4 py-3">R2/100</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3 text-right">Final/100</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#4a3670]/40">
            {rest.map((r) => (
              <tr key={r.participantId} className="hover:bg-[#1d1440]/60 transition-all">
                <td className="px-4 py-2.5 font-mono text-[#8f86ad]">#{r.rank}</td>
                <td className="px-4 py-2.5">
                  <div className="font-semibold">{r.name}</div>
                  <div className="font-mono text-[11px] text-[#8f86ad]">{r.registerNo}</div>
                </td>
                <td className="px-4 py-2.5 font-mono text-fuchsia-300">{r.round1Completed ? r.round1Score : '—'}</td>
                <td className="px-4 py-2.5 font-mono text-emerald-300">{r.round2Completed ? r.round2Score : '—'}</td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-[#8f86ad]">{r.round2Completed ? 'Sealed' : r.round1Completed ? 'R2 open' : 'R1'}</td>
                <td className="px-4 py-2.5 text-right font-display font-black text-amber-200">{r.totalScore}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center text-[#8f86ad] font-mono text-xs py-6">No investigators yet — the hall awaits its first verdict.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {top3.length > 0 && rest.length === 0 && (
        <p className="text-center font-mono text-[11px] text-[#5f5585] mt-2 flex items-center justify-center gap-1.5"><Gavel className="w-3.5 h-3.5" /> All contenders stand on the podium — the full table appears from 4th place.</p>
      )}
    </div>
  );
}
