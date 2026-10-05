import { useEffect, useState } from 'react';
import { Trophy, Gavel, Search, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import type { LeaderboardEntry } from '../types';

/** ADMIN ONLY — participants never see ranks or scores. All fetches carry the admin token. */
export default function Leaderboard({ live = false, token = '' }: { live?: boolean; token?: string }) {
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

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
  }, [live, token]);

  const top3 = rows.slice(0, 3);
  
  // When search is active, search across all participants so admin can find anyone;
  // when empty, show the remaining participants ordered by ranking starting from rank 4.
  const query = search.trim().toLowerCase();
  const pool = query
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.registerNo.toLowerCase().includes(query)
      )
    : rows.slice(3);

  const totalPool = pool.length;
  const totalPages = Math.max(1, Math.ceil(totalPool / limit));
  const currentPage = Math.min(page, totalPages);
  const displayedRows = pool.slice((currentPage - 1) * limit, currentPage * limit);

  function gotoPage(n: number) {
    setPage(Math.max(1, Math.min(totalPages, n)));
  }

  return (
    <div className="w-full space-y-5 animate-fadeIn">
      {/* Top Banner */}
      <div className="text-center">
        <div className="inline-flex px-3.5 py-1.5 rounded-full bg-[#150e28]/90 border border-amber-200/30 label-gold items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-amber-300" /> VERDICT HALL · FINAL SCORE OUT OF 100
          {live && (
            <span className="flex items-center gap-1 text-emerald-300 font-mono text-[11px]">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /> LIVE
            </span>
          )}
        </div>
        <h2 className="font-display font-black text-3xl mt-2 tracking-wider title-tribunal">
          LEADERBOARD
        </h2>
        <p className="font-mono text-[11px] text-[#8f86ad] mt-1">
          Final = (Round 1 raw + Round 2 raw) ÷ 6 · admin eyes only
        </p>
      </div>

      {/* Top Three Performers Podium */}
      {top3.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          {top3.map((r, i) => (
            <div
              key={r.participantId}
              className={`p-5 rounded-3xl text-center border-2 shadow-xl transition-all ${
                i === 0
                  ? 'border-amber-200/50 bg-gradient-to-b from-amber-400/15 via-[#150e28] to-[#150e28] sm:-translate-y-2 glow-verdict'
                  : 'border-[#4a3670]/70 bg-[#150e28]/90'
              }`}
            >
              <div
                className={`inline-block px-3 py-1 rounded-full font-mono text-[11px] font-bold ${
                  i === 0
                    ? 'bg-amber-300 text-[#241a05]'
                    : i === 1
                    ? 'bg-[#3d2c63] text-[#d9d2f2]'
                    : 'bg-amber-900/60 text-amber-200'
                }`}
              >
                {i === 0 ? '👑 1st Place' : i === 1 ? '🥈 2nd Place' : '🥉 3rd Place'}
              </div>
              <div className="font-bold mt-2 truncate text-base text-white">{r.name}</div>
              <div className="font-mono text-[11px] text-[#8f86ad]">
                {r.registerNo} {r.year ? `· Year: ${r.year}` : ''}
              </div>
              <div className="font-display font-black text-3xl mt-1 title-tribunal">
                {r.totalScore}
                <span className="text-sm font-sans font-normal text-[#8f86ad]">/100</span>
              </div>
              <div className="font-mono text-[10px] text-[#8f86ad] mt-1">
                R1 {r.round1Completed ? r.round1Score : '—'}/500 · R2 {r.round2Completed ? r.round2Score : '—'}/100
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Remaining Participants Section */}
      <div className="rounded-3xl border border-[#4a3670]/70 bg-[#150e28]/90 p-5 sm:p-6 shadow-xl">
        {/* Header with Title on Left and Search Option on Top Right */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-[#4a3670]/40 pb-4">
          <h3 className="font-mono text-xs uppercase tracking-widest text-[#cfc8ea] flex items-center gap-2 font-bold">
            <Users className="w-4 h-4 text-emerald-300" />
            {query ? 'Matching Participants' : 'Remaining Participants (Ordered by Ranking)'}{' '}
            <span className="px-2 py-0.5 rounded-full bg-[#241a45] text-amber-200 border border-[#4a3670]/60 text-[11px]">
              {totalPool}
            </span>
          </h3>

          {/* Search option in the top right */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#5f5585]" />
            <input
              id="leaderboard-search"
              className="pl-9 pr-3 py-2 rounded-xl bg-[#0a0614]/80 border border-[#4a3670]/70 text-xs font-sans focus:border-amber-300 focus:ring-1 focus:ring-amber-300/40 outline-none placeholder:text-[#5f5585] text-[#ece9f7] w-64 transition-all"
              placeholder="Search name or reg no…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* Remaining Participants Table */}
        <div className="overflow-x-auto mt-4 rounded-2xl border border-[#4a3670]/60 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0a0614]/90 border-b border-[#4a3670]/60 text-[11px] uppercase font-mono text-[#8f86ad] text-left">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Investigator</th>
                <th className="px-4 py-3">R1/500</th>
                <th className="px-4 py-3">R2/100</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Focus</th>
                <th className="px-4 py-3 text-right">Final/100</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4a3670]/40">
              {displayedRows.map((r) => {
                const pct = Math.min(100, Math.round(((r.totalScore || 0) / 100) * 100));
                const violationsCount =
                  (r.violations?.tabHidden || 0) + (r.violations?.fullscreenExit || 0);

                return (
                  <tr key={r.participantId} className="hover:bg-[#1d1440]/60 transition-all">
                    <td className="px-4 py-3 font-mono font-bold text-[#cfc8ea]">#{r.rank}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{r.name}</div>
                      <div className="font-mono text-[11px] text-[#8f86ad]">
                        {r.registerNo} {r.year ? `· Year: ${r.year}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-fuchsia-300">
                      {r.round1Completed ? r.round1Score : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-300">
                      {r.round2Completed ? r.round2Score : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-[#241a45] h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-violet-500 via-fuchsia-400 to-amber-300 h-2 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span
                          className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                            r.round2Completed
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/40'
                              : r.round1Completed
                              ? 'bg-amber-300/10 text-amber-200 border border-amber-200/40'
                              : 'bg-[#0a0614] text-[#8f86ad] border border-[#4a3670]'
                          }`}
                        >
                          {r.round2Completed ? 'Sealed' : r.round1Completed ? 'R2 open' : 'R1'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {violationsCount > 0 ? (
                        <span className="text-red-300">
                          {r.violations?.tabHidden || 0}T/{r.violations?.fullscreenExit || 0}F
                        </span>
                      ) : (
                        <span className="text-[#5f5585]">clean</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-display font-black text-amber-200 text-sm">
                      {r.totalScore}
                    </td>
                  </tr>
                );
              })}

              {displayedRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-[#8f86ad] font-mono text-xs py-8">
                    {query ? (
                      'No participants found matching your search.'
                    ) : top3.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-[#8f86ad]">
                        <Gavel className="w-4 h-4 text-amber-300" />
                        All contenders stand on the podium — remaining participants will appear from 4th place.
                      </span>
                    ) : (
                      'No investigators registered yet.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination: Limit 10, see next 10 */}
        {totalPool > 0 && (
          <div className="flex items-center justify-between mt-4 flex-wrap gap-2 pt-2">
            <span className="font-mono text-[11px] text-[#8f86ad]">
              Showing {Math.min(totalPool, (currentPage - 1) * limit + 1)}–
              {Math.min(totalPool, currentPage * limit)} of {totalPool} participants
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => gotoPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 rounded-lg border border-[#4a3670]/60 text-[#d9d2f2] disabled:opacity-30 hover:bg-[#1d1440] flex items-center gap-1 font-mono text-[11px] cursor-pointer transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> PREV
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (n) =>
                    n === 1 ||
                    n === totalPages ||
                    Math.abs(n - currentPage) <= 1
                )
                .map((n) => (
                  <button
                    key={n}
                    onClick={() => gotoPage(n)}
                    className={`w-8 h-8 rounded-lg font-mono text-[11px] border transition-all cursor-pointer ${
                      n === currentPage
                        ? 'bg-amber-300 text-[#241a05] border-amber-200/60 font-bold'
                        : 'border-[#4a3670]/60 text-[#d9d2f2] hover:bg-[#1d1440]'
                    }`}
                  >
                    {n}
                  </button>
                ))}

              <button
                onClick={() => gotoPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-[#4a3670]/60 text-[#d9d2f2] disabled:opacity-30 hover:bg-[#1d1440] flex items-center gap-1 font-mono text-[11px] cursor-pointer transition-all"
              >
                NEXT <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
