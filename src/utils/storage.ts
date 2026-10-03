import { Participant } from '../types';

const KEY = 'finalevent_participant';
const ADMIN_KEY = 'finalevent_admin_token';

export function saveParticipant(p: Participant) { localStorage.setItem(KEY, JSON.stringify(p)); }
export function getStoredParticipant(): Participant | null {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function clearAllCookiesAndStorage() {
  // Clear localStorage (participant + admin) and all cookies, then go home
  localStorage.removeItem(KEY);
  localStorage.removeItem(ADMIN_KEY);
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
    }
  });
}
export function saveAdminToken(t: string) { localStorage.setItem(ADMIN_KEY, t); }
export function getAdminToken(): string | null { return localStorage.getItem(ADMIN_KEY); }
export function clearAdminToken() { localStorage.removeItem(ADMIN_KEY); }
