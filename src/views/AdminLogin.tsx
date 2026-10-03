import { useState } from 'react';
import { Shield, ChevronLeft, Lock } from 'lucide-react';
import { saveAdminToken } from '../utils/storage';
import { soundFX } from '../utils/audio';
import { enterFullscreen } from '../utils/fullscreen';

export default function AdminLogin({ onLogin, onBack }: { onLogin: () => void; onBack: () => void }) {
  const [email, setEmail] = useState('admin@gces.in');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const d = await res.json();
    if (!res.ok) { soundFX.playFail(); setErr(d.error || 'Login failed'); return; }
    saveAdminToken(d.token);
    void enterFullscreen();
    onLogin();
  }

  return (
    <div className="relative max-w-md mx-auto mt-10 px-4 animate-fadeIn">
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-96 h-48 bg-amber-500/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="relative rounded-3xl panel-tribunal backdrop-blur-xl p-8 shadow-2xl glow-verdict">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#1d1440] border border-amber-200/40 flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-200" />
          </span>
          <div>
            <h2 className="font-dossier text-2xl font-bold leading-none">VERDICT CHAMBER</h2>
            <p className="label-gold mt-1">Admin Login · Restricted</p>
          </div>
        </div>
        <p className="text-xs text-[#8f86ad] mt-3 font-mono">id: admin@gces.in · password: Admin@GCES123</p>
        <form onSubmit={submit} className="space-y-3 mt-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider font-mono text-[#cfc8ea]">Admin ID</label>
            <input className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#0a0614]/80 border border-[#4a3670]/70 text-sm font-sans focus:border-amber-200 focus:ring-1 focus:ring-amber-200/40 outline-none placeholder:text-[#5f5585]" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@gces.in" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider font-mono text-[#cfc8ea]">Password</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-[#5f5585]" />
              <input className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0a0614]/80 border border-[#4a3670]/70 text-sm font-sans focus:border-amber-200 focus:ring-1 focus:ring-amber-200/40 outline-none placeholder:text-[#5f5585]" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" />
            </div>
          </div>
          {err && <div className="text-red-300 text-xs font-mono bg-red-950/70 border border-red-400/50 rounded-xl px-3 py-2 animate-fadeIn">{err}</div>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => { soundFX.playClick(); onBack(); }} className="w-1/3 px-4 py-2.5 rounded-xl font-mono text-xs bg-[#241a45] hover:bg-[#2d2154] text-[#d9d2f2] flex items-center justify-center gap-1">
              <ChevronLeft className="w-4 h-4" /> BACK
            </button>
            <button className="w-2/3 px-4 py-2.5 rounded-xl font-mono font-bold text-xs bg-gradient-to-r from-amber-400 to-yellow-300 hover:brightness-110 text-[#241a05]">
              OPEN VERDICT CHAMBER →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
