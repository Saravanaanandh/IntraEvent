import { useState } from 'react';
import { UserCheck, ChevronLeft, Fingerprint, KeyRound, ExternalLink } from 'lucide-react';
import { saveParticipant, getStoredParticipant } from '../utils/storage';
import { soundFX } from '../utils/audio';
import { enterFullscreen } from '../utils/fullscreen';
import type { Participant } from '../types';

const OLLAMA_KEYS_URL = 'https://ollama.com/settings/keys';

export default function ParticipantLogin({ onLogin, onBack }: { onLogin: (p: Participant) => void; onBack: () => void }) {
  // Returning participants get name + register no prefilled — only the Ollama key is re-entered.
  const stored = getStoredParticipant();
  const [name, setName] = useState(stored?.name || '');
  const [registerNo, setRegisterNo] = useState(stored?.registerNo || '');
  const [college, setCollege] = useState(stored?.college || '');
  const [apiKey, setApiKey] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!apiKey.trim()) {
      setErr('Ollama API key is required — click GET KEY, copy your key, and paste it here.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/participant/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, registerNo, college, ollamaKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      saveParticipant(data.participant);
      void enterFullscreen();
      onLogin(data.participant);
    } catch (ex: any) { soundFX.playFail(); setErr(ex.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="relative max-w-md mx-auto mt-10 px-4 animate-fadeIn">
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-96 h-48 bg-fuchsia-600/15 blur-[130px] rounded-full pointer-events-none" />
      <div className="relative rounded-3xl panel-tribunal backdrop-blur-xl p-8 shadow-2xl glow-arena">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#1d1440] border border-fuchsia-400/40 flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-fuchsia-300" />
          </span>
          <div>
            <h2 className="font-dossier text-2xl font-bold leading-none">TRIBUNAL ENROLLMENT</h2>
            <p className="label-gold mt-1">Participant Login · File #2026-FE</p>
          </div>
        </div>
        <p className="text-xs text-[#8f86ad] mt-3 font-mono">Login using Name, Register No / unique no, and your own Ollama API key.</p>
        {stored && (
          <div className="mt-2 font-mono text-[11px] px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 animate-fadeIn">
            Welcome back, {stored.name} — your details are filled in. Just paste your Ollama key to continue.
          </div>
        )}
        <form onSubmit={submit} className="space-y-3 mt-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider font-mono text-[#cfc8ea]">Full Name</label>
            <div className="relative mt-1">
              <UserCheck className="absolute left-3 top-3 w-4 h-4 text-[#5f5585]" />
              <input className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0a0614]/80 border border-[#4a3670]/70 text-sm font-sans focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400/40 outline-none placeholder:text-[#5f5585]" placeholder="e.g. Arun Kumar" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider font-mono text-[#cfc8ea]">Register No / Unique No</label>
            <div className="relative mt-1">
              <Fingerprint className="absolute left-3 top-3 w-4 h-4 text-[#5f5585]" />
              <input className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0a0614]/80 border border-[#4a3670]/70 text-sm font-sans focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400/40 outline-none placeholder:text-[#5f5585]" placeholder="4–20 chars, e.g. REG12345" value={registerNo} onChange={(e) => setRegisterNo(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider font-mono text-[#cfc8ea]">College (optional)</label>
            <input className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#0a0614]/80 border border-[#4a3670]/70 text-sm font-sans focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400/40 outline-none placeholder:text-[#5f5585]" placeholder="e.g. GCES" value={college} onChange={(e) => setCollege(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider font-mono text-[#cfc8ea]">Your Ollama API Key</label>
              <button
                type="button"
                onClick={() => { soundFX.playClick(); window.open(OLLAMA_KEYS_URL, '_blank', 'noopener,noreferrer'); }}
                className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-amber-300/10 border border-amber-200/40 text-amber-200 hover:brightness-125 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> GET KEY
              </button>
            </div>
            <div className="relative mt-1">
              <KeyRound className="absolute left-3 top-3 w-4 h-4 text-[#5f5585]" />
              <input
                type="password"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0a0614]/80 border border-[#4a3670]/70 text-sm font-code focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400/40 outline-none placeholder:text-[#5f5585]"
                placeholder="Paste key from ollama.com → settings → keys"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
            </div>
            <p className="text-[11px] text-[#5f5585] font-mono mt-1 leading-relaxed">
              Click GET KEY → sign in at ollama.com → open the <b className="text-amber-200">API keys</b> section → create &amp; copy a key → paste it here. All your chats run on this key.
            </p>
          </div>
          {err && <div className="text-red-300 text-xs font-mono bg-red-950/70 border border-red-400/50 rounded-xl px-3 py-2 animate-fadeIn">{err}</div>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => { soundFX.playClick(); onBack(); }} className="w-1/3 px-4 py-2.5 rounded-xl font-mono text-xs bg-[#241a45] hover:bg-[#2d2154] text-[#d9d2f2] flex items-center justify-center gap-1">
              <ChevronLeft className="w-4 h-4" /> BACK
            </button>
            <button disabled={loading} className="w-2/3 px-4 py-2.5 rounded-xl font-mono font-bold text-xs btn-tribunal disabled:opacity-60">
              {loading ? 'VERIFYING…' : 'ENTER THE TRIBUNAL →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
