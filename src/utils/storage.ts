import { Participant } from '../types';

const KEY = 'finalevent_participant';
const ADMIN_KEY = 'finalevent_admin_token';
export const OLLAMA_KEY_COOKIE = 'ollama_api_key';

export function saveParticipant(p: Participant) { localStorage.setItem(KEY, JSON.stringify(p)); }
export function getStoredParticipant(): Participant | null {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}

export function saveApiKeyCookie(key: string) {
  if (!key) return;
  const trimmed = key.trim();
  // 365 days expiration so closing and reopening Chrome keeps the cookie
  const d = new Date();
  d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000));
  const expires = 'expires=' + d.toUTCString();
  document.cookie = `${OLLAMA_KEY_COOKIE}=${encodeURIComponent(trimmed)};${expires};path=/;SameSite=Lax`;
  try {
    localStorage.setItem(OLLAMA_KEY_COOKIE, trimmed);
  } catch {}
}

export function getStoredApiKey(): string {
  try {
    const name = `${OLLAMA_KEY_COOKIE}=`;
    const decoded = decodeURIComponent(document.cookie);
    const ca = decoded.split(';');
    for (let i = 0; i < ca.length; i++) {
      const c = ca[i].trim();
      if (c.indexOf(name) === 0) {
        const val = c.substring(name.length);
        if (val) return val;
      }
    }
  } catch {}
  try {
    return localStorage.getItem(OLLAMA_KEY_COOKIE) || '';
  } catch {
    return '';
  }
}

export function clearAllCookiesAndStorage() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLLAMA_KEY_COOKIE);
    localStorage.removeItem(ADMIN_KEY);
    sessionStorage.clear();
  } catch {}

  const domain = window.location.hostname;
  // Wipe all cookies including OLLAMA_KEY_COOKIE to prevent credential leakage
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const eqPos = cookie.indexOf('=');
    const name = (eqPos > -1 ? cookie.substring(0, eqPos) : cookie).trim();
    if (!name) continue;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=;SameSite=Lax`;
    if (domain) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${domain};SameSite=Lax`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${domain};SameSite=Lax`;
    }
  }
}
export function saveAdminToken(t: string) { localStorage.setItem(ADMIN_KEY, t); }
export function getAdminToken(): string | null { return localStorage.getItem(ADMIN_KEY); }
export function clearAdminToken() { localStorage.removeItem(ADMIN_KEY); }

