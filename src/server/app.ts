import express from 'express';
import crypto from 'node:crypto';
import { Participant, ChatMessage, BeliefState, CaseConfig } from '../types.js';
import { estimateTokens, generateLieResponse, evaluateLieConversation, simulateLieResponse, isGeminiConfigured, scoreLieEfficiency, LIE_MIN_TURNS, LIE_TIME_LIMIT_SEC, LIE_MAX_PROMPTS, updateActiveLieConfig } from './lieEngine.js';
import { DEFAULT_CASE, STORIES, DEFAULT_STORY_ID, getStory, suspectReply, detectClues, extractClueTags, stripClueTags, scoreDetective } from './detectiveEngine.js';
import { storyMeta } from './stories.js';
import { KEY_POOL_SIZE, keyForSlot } from './keypool.js';
import { generateLieReplyOllama, refereeLieOllama, defaultOllamaModel } from './ollamaService.js';
import {
  persistParticipant,
  persistLieSession,
  persistDetSession,
  persistConfig,
  wipeMongo,
  loadAllFromMongo,
  loadParticipantDoc,
  loadParticipantByRegNo,
  loadLieDoc,
  loadDetDoc,
  loadConfigDoc,
  nextKeySlot,
  updateParticipantAtomic,
  recordViolationAtomic,
  updateParticipantRound1Atomic,
  updateParticipantRound2Atomic,
  updateParticipantFieldsAtomic,
  acquireLieTurnLock,
  releaseLieTurnLock,
  appendLieTurnAtomic,
  acquireLieFinishLock,
  releaseLieFinishLock,
  markLieSessionFinishedAtomic,
  saveLieSessionDoc,
  ParticipantDoc,
  LieSessionDoc,
} from './db.js';

export const ADMIN_EMAIL = 'admin@gces.in';
export const ADMIN_PASSWORD = 'Admin@GCES123';
export const ADMIN_TOKEN = 'admin-token-gces-finalevent';

// MongoDB is the ONLY store. Every mutation below calls its persist*
// helper (Mongo write-through); boot hydrates via hydrateStore().
// No local files are read or written.

interface LieSession {
  participantId: string;
  messages: ChatMessage[];
  belief: BeliefState;
  promptsUsed: number;
  startedAt: number;
  finished: boolean;
  cfgVersion?: number;
  processing?: boolean;
  processingStartedAt?: number;
  finishing?: boolean;
  finishingStartedAt?: number;
}
interface DetSession { participantId: string; chats: Record<string, ChatMessage[]>; qCounts: Record<string, number>; cluesFound: string[]; suspectsQ: string[]; notes: string; startedAt: number; language: string; storyId?: string; }
interface Store {
  participants: Record<string, Participant>;
  lieSessions: Record<string, LieSession>;
  detSessions: Record<string, DetSession>;
  config: { lieImageUrl: string; truthLabel: string; truthKeywords: string[]; falseLabel: string; falseKeywords: string[]; caseConfig: CaseConfig; eventName: string; round2DurationSec: number; activeStoryId: string; lieVersion: number };
}

export const ROUND2_DEFAULT_DURATION_SEC = 60 * 60; // 1-hour Round-2 timer (60 minutes)

function defaultStore(): Store {
  return { participants: {}, lieSessions: {}, detSessions: {}, config: { lieImageUrl: '', truthLabel: '', truthKeywords: [], falseLabel: '', falseKeywords: [], caseConfig: DEFAULT_CASE, eventName: 'Final Event — AI Lying + AI Detective', round2DurationSec: ROUND2_DEFAULT_DURATION_SEC, activeStoryId: DEFAULT_STORY_ID, lieVersion: 1 } };
}

let store: Store = defaultStore();
updateActiveLieConfig({
  label: store.config.truthLabel,
  keywords: store.config.truthKeywords,
  falseLabel: store.config.falseLabel,
  falseKeywords: store.config.falseKeywords,
});

// SSE clients
const sseClients: { res: any }[] = [];
function broadcast(type: string, data: any) {
  const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of sseClients) { try { c.res.write(msg); } catch {} }
}

// Combined final score OUT OF 100 ONLY.
// Round 1 max 500 + Round 2 max 100 = 600 raw -> final = raw / 6.
// This preserves the original 500:100 weighting from the source repos.
export function finalScoreOutOf100(round1Score: number, round2Score: number): number {
  return Math.round((((round1Score || 0) + (round2Score || 0)) / 6) * 10) / 10;
}

// Never leak a participant's Ollama key to any client (participant UI or admin UI).
export function stripKey(p: Participant): Omit<Participant, 'ollamaKey'> {
  const { ollamaKey, ...safe } = p;
  return safe;
}

// Crash recovery: MongoDB is the only source — hydrate everything from it.
export async function hydrateStore() {
  try {
    const docs = await loadAllFromMongo();
    if (!docs) return;
    for (const [k, v] of Object.entries(docs.participants)) {
      // Self-heal legacy rows: totalScore is ALWAYS the /100 final now.
      (v as Participant).totalScore = finalScoreOutOf100((v as Participant).round1Score, (v as Participant).round2Score);
      store.participants[k] = v;
      persistParticipant(v as Participant);
    }
    for (const [k, v] of Object.entries(docs.lieSessions)) store.lieSessions[k] = v;
    for (const [k, v] of Object.entries(docs.detSessions)) store.detSessions[k] = v;
    if (docs.config) {
      const d = defaultStore().config;
      store.config = { ...d, ...docs.config, caseConfig: (docs.config as any).caseConfig || getStory((docs.config as any).activeStoryId || DEFAULT_STORY_ID).case };
      if (!(store.config as any).activeStoryId) (store.config as any).activeStoryId = DEFAULT_STORY_ID;
      if (!(store.config as any).lieVersion) (store.config as any).lieVersion = 1;
      updateActiveLieConfig({
        label: store.config.truthLabel,
        keywords: store.config.truthKeywords,
        falseLabel: store.config.falseLabel,
        falseKeywords: store.config.falseKeywords,
      });
    }
    console.log(`[mongo] hydrated ${Object.keys(docs.participants).length} users + conversations${docs.config ? ' + event config' : ''}.`);
  } catch {
    console.warn('[mongo] hydrate skipped — starting empty.');
  }
}

// Admin updates must go LIVE on every instance, not just the one that served
// the admin click. Config is re-read from Mongo (single-doc read) ahead of
// every config-dependent route, so label/image/story switches propagate
// within one request on serverless instances too.
async function refreshConfig() {
  try {
    const doc = await loadConfigDoc();
    if (!doc) return;
    const d = defaultStore().config;
    store.config = { ...d, ...store.config, ...doc, caseConfig: (doc as any).caseConfig || getStory((doc as any).activeStoryId || (store.config as any).activeStoryId || DEFAULT_STORY_ID).case };
    if (!(store.config as any).activeStoryId) (store.config as any).activeStoryId = DEFAULT_STORY_ID;
    if (!(store.config as any).lieVersion) (store.config as any).lieVersion = 1;
    updateActiveLieConfig({
      label: store.config.truthLabel,
      keywords: store.config.truthKeywords,
      falseLabel: store.config.falseLabel,
      falseKeywords: store.config.falseKeywords,
    });
  } catch {
    /* keep in-memory config on read failure */
  }
}

async function createFreshLieSession(pid: string, lockProcessing = false): Promise<LieSession> {
  const s: LieSession = {
    participantId: pid,
    messages: [],
    belief: {
      initialBelief: store.config.falseLabel,
      currentBelief: store.config.falseLabel,
      isConvinced: false,
    },
    promptsUsed: 0,
    startedAt: Date.now(),
    finished: false,
    cfgVersion: (store.config as any).lieVersion || 1,
    processing: lockProcessing,
    processingStartedAt: lockProcessing ? Date.now() : undefined,
  };
  store.lieSessions[pid] = s;
  await saveLieSessionDoc(s);
  return s;
}

function freshDetSession(pid: string) {
  const s: DetSession = { participantId: pid, chats: {}, qCounts: {}, cluesFound: [], suspectsQ: [], notes: '', startedAt: Date.now(), language: 'english', storyId: (store.config as any).activeStoryId || DEFAULT_STORY_ID };
  store.detSessions[pid] = s;
  persistDetSession(s);
  return s;
}

// Shared key pool: every participant owns a STABLE slot (round-robin at
// creation). Re-logins and old rows without a slot are assigned lazily.
// The raw keys never leave the server — callers only get keyForSlot().
async function ensureKeySlot(p: Participant): Promise<number> {
  const cur = Number((p as any).keySlot);
  if (Number.isInteger(cur) && cur >= 0 && cur < KEY_POOL_SIZE) return cur;
  const slot = await nextKeySlot(KEY_POOL_SIZE);
  (p as any).keySlot = slot;
  void updateParticipantFieldsAtomic(p.id, { keySlot: slot } as any);
  return slot;
}

// Safety net: if an AI reply is byte-identical to its previous reply, nudge
// the conversation forward with a rotating follow-up instead of echoing.
const LIE_REPEAT_TAILS = [
  'What specifically in the image supports that?',
  'Point me to one concrete visual detail.',
  'Describe one concrete visual detail that proves it.',
  'Give me the mechanism, not just the claim.',
];
const DETECTIVE_REPEAT_TAILS = [
  'What were you doing at the exact time it happened?',
  'Who else was near the scene that night?',
  'Walk me through that night minute by minute.',
  'What are you not telling me about that night?',
];
function breakRepeat(reply: string, lastAiText: string | undefined, turn: number, tails: string[] = LIE_REPEAT_TAILS): string {
  if (!lastAiText || reply.trim() !== lastAiText.trim()) return reply;
  return `${reply} ${tails[turn % tails.length]}`;
}

// Serverless load-through: instance memory is per-function, Mongo is truth.
// Every handler ensures what it needs; misses are backfilled from Mongo.
async function ensureParticipantById(id: string): Promise<Participant | undefined> {
  const key = String(id);
  const doc = await loadParticipantDoc(key);
  if (doc) {
    store.participants[key] = doc;
    return doc;
  }
  return store.participants[key];
}

// DB-first load: MongoDB is the single source of truth across serverless instances.
async function ensureLie(pid: string): Promise<LieSession | null> {
  const doc = await loadLieDoc(pid);
  if (doc) {
    store.lieSessions[pid] = doc;
    return doc;
  }
  return store.lieSessions[pid] || null;
}

async function ensureDet(pid: string): Promise<DetSession | null> {
  const doc = await loadDetDoc(pid);
  if (doc) {
    store.detSessions[pid] = doc;
    return doc;
  }
  return store.detSessions[pid] || null;
}

// What participants are allowed to know: what happened, when, who was
// around. The full storyText never leaves the server (it drives the AI).
function publicCase() {
  const c = store.config.caseConfig;
  return {
    caseTitle: c.caseTitle,
    victim: c.victim,
    storyText: (c as any).publicBrief || DEFAULT_CASE.publicBrief,
    suspects: c.suspects.map((x) => ({ id: x.id, name: x.name, role: x.role })),
    clues: c.clues,
  };
}

export function leaderboard() {
  const list = Object.values(store.participants).map((p) => ({
    participantId: p.id,
    name: p.name,
    registerNo: p.registerNo,
    year: (p as any).year || p.college || '',
    round1Score: p.round1Score,
    round2Score: p.round2Score,
    totalScore: finalScoreOutOf100(p.round1Score, p.round2Score),
    round1Completed: p.round1Completed,
    round2Completed: p.round2Completed,
    violations: p.violations,
  }));
  list.sort((a, b) => b.totalScore - a.totalScore || b.round1Score - a.round1Score || a.name.localeCompare(b.name));
  return list.map((e, i) => ({ rank: i + 1, ...e }));
}

function requireAdmin(req: any, res: any, next: any) {
  const h = String(req.headers.authorization || '');
  const token = h.startsWith('Bearer ') ? h.slice(7) : String(req.query.token || req.body?.adminToken || '');
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Admin auth required' });
  next();
}

export function buildApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // ---------- public status & config ----------
  app.get('/api', (_req, res) => {
    res.json({ ok: true, service: 'Midnight Tribunal API', status: 'online' });
  });

  app.get('/api/config', (_req, res) => {
    res.json({ eventName: store.config.eventName, lieImageUrl: store.config.lieImageUrl, caseTitle: store.config.caseConfig.caseTitle, victim: store.config.caseConfig.victim, storyText: store.config.caseConfig.storyText, suspects: store.config.caseConfig.suspects.map((s) => ({ id: s.id, name: s.name, role: s.role, personality: s.personality })), clues: store.config.caseConfig.clues, round2DurationSec: store.config.round2DurationSec });
  });

  // ---------- participant auth (name + register no + year; key comes from the server pool) ----------
  app.post('/api/participant/login', async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const registerNo = String(req.body?.registerNo || req.body?.registerNumber || '').trim().toUpperCase();
    const year = String(req.body?.year || req.body?.college || '').trim();
    const college = String(req.body?.college || req.body?.year || '').trim();
    if (!/^[A-Za-z\s]{2,60}$/.test(name)) return res.status(400).json({ error: 'Enter valid name (2-60 letters).' });
    if (!/^[A-Za-z0-9\-_]{4,20}$/.test(registerNo)) return res.status(400).json({ error: 'Enter valid Register No / unique no (4-20 alphanumeric).' });
    let p = Object.values(store.participants).find((x) => x.registerNo === registerNo);
    if (!p) {
      // Serverless load-through: another instance may own this user.
      const doc = await loadParticipantByRegNo(registerNo);
      if (doc) { store.participants[doc.id] = doc; p = doc; }
    }
    if (p && p.name.toLowerCase().replace(/\s+/g, ' ').trim() !== name.toLowerCase().replace(/\s+/g, ' ').trim()) {
      return res.status(401).json({ error: 'Register No already registered with a different name. Contact admin.' });
    }
    if (!p) {
      const id = `p_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      p = { id, name, registerNo, year, college, createdAt: new Date().toISOString(), round1Completed: false, round1Score: 0, round2Completed: false, round2Score: 0, totalScore: 0 };
      store.participants[id] = p; persistParticipant(p); broadcast('players_updated', { count: Object.keys(store.participants).length });
    } else {
      if (year) {
        p.year = year;
        void updateParticipantFieldsAtomic(p.id, { year });
      }
    }
    // Stable pooled key slot (round-robin); the raw key is never exposed.
    await ensureKeySlot(p);
    // Participants only ever receive identity + progress flags — never scores.
    const { id, name: pname, registerNo: preg, college: pcollege, year: pyear, createdAt, round1Completed, round2Completed } = p;
    res.json({ participant: { id, name: pname, registerNo: preg, college: pcollege, year: pyear || pcollege, createdAt, round1Completed, round2Completed } });
  });

  // ---------- focus-lock violations (tab hidden / fullscreen exited mid-round) ----------
  app.post('/api/participant/violation', async (req, res) => {
    const { participantId, kind } = req.body || {};
    if (kind !== 'tab' && kind !== 'fs') return res.status(400).json({ error: 'Unknown violation kind.' });
    const p = await ensureParticipantById(String(participantId));
    if (!p) return res.status(404).json({ error: 'Participant not found.' });
    // ATOMIC FIX: Use $inc directly in MongoDB. Concurrent violation events will
    // never overwrite scores or progress flags.
    const updatedViolations = await recordViolationAtomic(p.id, kind);
    if (updatedViolations) {
      p.violations = updatedViolations;
    } else {
      if (!p.violations) p.violations = { tabHidden: 0, fullscreenExit: 0 };
      if (kind === 'tab') p.violations.tabHidden++;
      else if (kind === 'fs') p.violations.fullscreenExit++;
    }
    res.json({ ok: true, violations: p.violations });
  });

  // ---------- Round 1: Lie (resumes unfinished session after interrupts) ----------
  app.post('/api/lie/start', async (req, res) => {
    await refreshConfig();
    const { participantId } = req.body || {};
    const pid = String(participantId || '');
    if (!pid) return res.status(400).json({ error: 'Missing participantId.' });
    const p = await ensureParticipantById(pid);
    if (!p) return res.status(404).json({ error: 'Participant not found. Login again.' });
    if (p.round1Completed) return res.status(403).json({ error: 'Round 1 already completed. Round 2 is unlocked.' });
    await ensureKeySlot(p);
    const existing = await loadLieDoc(p.id);
    const liveVersion = (store.config as any).lieVersion || 1;
    if (existing && !existing.finished && (existing.cfgVersion || 1) === liveVersion) {
      store.lieSessions[p.id] = existing;
      // Resume — do NOT wipe conversation after an interrupt.
      return res.json({ resumed: true, promptsUsed: existing.promptsUsed, imageUrl: store.config.lieImageUrl, messages: existing.messages, startedAt: existing.startedAt, timeLimitSec: LIE_TIME_LIMIT_SEC });
    }
    // New session, or admin changed image/labels since (stale sessions restart
    // on the NEW exhibit so old labels never leak into the chat again).
    const fresh = await createFreshLieSession(p.id);
    res.json({ resumed: false, promptsUsed: 0, imageUrl: store.config.lieImageUrl, messages: [], startedAt: fresh.startedAt, timeLimitSec: LIE_TIME_LIMIT_SEC });
  });

  app.post('/api/lie/message', async (req, res) => {
    await refreshConfig();
    const { participantId, prompt } = req.body || {};
    const pid = String(participantId || '');
    if (!pid) return res.status(400).json({ error: 'Missing participantId.' });

    const p = await ensureParticipantById(pid);
    if (!p) return res.status(404).json({ error: 'Start Round 1 first.' });
    if (p.round1Completed) return res.status(403).json({ error: 'Round 1 already completed.' });

    const text = String(prompt || '').trim();
    if (!text) return res.status(400).json({ error: 'Empty prompt.' });

    // ATOMIC LOCK GUARD: Acquire processing lock in MongoDB to prevent concurrent turns / double-submits
    const lock = await acquireLieTurnLock(pid);
    if (!lock.locked) {
      if (lock.reason === 'NOT_FOUND') return res.status(404).json({ error: 'Start Round 1 first.' });
      if (lock.reason === 'FINISHED') return res.status(403).json({ error: 'Round 1 finished. Please finish/evaluate.' });
      if (lock.reason === 'LOCKED') {
        return res.status(409).json({ error: 'Turn already in progress. Please wait for AI to finish.' });
      }
      return res.status(500).json({ error: 'Could not process turn at this time.' });
    }

    let sess = lock.session as LieSession;
    let lockHeld = true;

    try {
      if (sess.finished) {
        return res.status(403).json({ error: 'Round 1 finished. Please finish/evaluate.' });
      }

      // Admin changed the exhibit/labels mid-round: migrate this session onto the
      // NEW labels automatically so stale values can never appear in chat.
      const liveVersion = (store.config as any).lieVersion || 1;
      if ((sess.cfgVersion || 1) !== liveVersion) {
        sess = await createFreshLieSession(p.id, true);
      }

      // 15-minute round timer — enforced server-side.
      if (Date.now() - sess.startedAt > LIE_TIME_LIMIT_SEC * 1000) {
        return res.status(403).json({ error: 'TIME_EXPIRED', message: 'Time expired — submitting your round now.' });
      }

      if (sess.promptsUsed >= LIE_MAX_PROMPTS) {
        return res.status(400).json({ error: 'Please submit your round now to continue.' });
      }

      const now = new Date().toISOString();
      const userMsg: ChatMessage = { id: `u${Date.now()}`, sender: 'user', text, timestamp: now };
      const turn = sess.promptsUsed + 1;
      const history = sess.messages || [];
      const truth = {
        label: store.config.truthLabel,
        keywords: store.config.truthKeywords,
        falseLabel: store.config.falseLabel,
        falseKeywords: store.config.falseKeywords,
      };

      // Shared organizer key pool (stable slot per participant), then Gemini,
      // then local simulation. Engine is reported so the UI can flag degraded
      // (local-opponent) mode.
      const oKey = keyForSlot(await ensureKeySlot(p));
      const lastAiText = [...history].reverse().find((m) => m.sender === 'ai')?.text;
      let r: any;
      let engine: 'ollama' | 'gemini' | 'simulation' = 'simulation';

      if (oKey) {
        try {
          r = await generateLieReplyOllama(history, text, turn, sess.belief, store.config.lieImageUrl, oKey, defaultOllamaModel(), truth);
          engine = 'ollama';
        } catch (e: any) {
          if (/Invalid Ollama API key/i.test(String(e?.message || ''))) {
            return res.status(401).json({ error: String(e.message) });
          }
          console.warn(`[lie] ollama failed for ${p.id}, falling back:`, String(e?.message || e).slice(0, 160));
          if (isGeminiConfigured()) {
            r = await generateLieResponse(history, text, turn, sess.belief, store.config.lieImageUrl, truth);
            engine = 'gemini';
          } else {
            const s0 = simulateLieResponse(history, text, turn, sess.belief, truth);
            r = { ...s0, latencyMs: 0 };
          }
        }
      } else if (isGeminiConfigured()) {
        r = await generateLieResponse(history, text, turn, sess.belief, store.config.lieImageUrl, truth);
        engine = 'gemini';
      } else {
        const s0 = simulateLieResponse(history, text, turn, sess.belief, truth);
        r = { ...s0, latencyMs: 0 };
      }

      const replyText = breakRepeat(r.text, lastAiText, turn);
      const aiMsg: ChatMessage = { id: `a${Date.now()}`, sender: 'ai', text: replyText, timestamp: now };

      // ATOMIC UPDATE: $push messages and $inc promptsUsed in a single findOneAndUpdate with { new: true }
      // Fully awaited before sending response to client so state is 100% committed to MongoDB.
      const updatedSess = await appendLieTurnAtomic(pid, userMsg, aiMsg, r.updatedBeliefState);
      lockHeld = false; // lock released atomically by appendLieTurnAtomic

      if (updatedSess) {
        store.lieSessions[p.id] = updatedSess;
        sess = updatedSess;
      } else {
        // In-memory fallback if Mongo disconnected
        sess.messages = [...history, userMsg, aiMsg];
        sess.belief = r.updatedBeliefState;
        sess.promptsUsed = turn;
        sess.processing = false;
        store.lieSessions[p.id] = sess;
      }

      res.json({
        reply: replyText,
        promptsUsed: sess.promptsUsed,
        tokens: estimateTokens(text),
        engine,
      });
    } finally {
      if (lockHeld) {
        await releaseLieTurnLock(pid);
      }
    }
  });

  app.post('/api/lie/finish', async (req, res) => {
    const { participantId } = req.body || {};
    const pid = String(participantId || '');
    if (!pid) return res.status(400).json({ error: 'Missing participantId.' });

    const p = await ensureParticipantById(pid);
    if (!p) return res.status(404).json({ error: 'Participant not found.' });

    // ATOMIC FINISH GUARD: Prevent concurrent/duplicate finish submissions
    const lock = await acquireLieFinishLock(pid);
    if (!lock.locked) {
      if (lock.reason === 'ALREADY_FINISHED') {
        return res.json({ round2Unlocked: true, alreadyFinished: true });
      }
      if (lock.reason === 'LOCKED') {
        return res.status(409).json({ error: 'Round finish evaluation in progress. Please wait.' });
      }
      if (lock.reason === 'NOT_FOUND') {
        return res.status(404).json({ error: 'No session.' });
      }
      return res.status(500).json({ error: 'Could not process finish request.' });
    }

    let sess = lock.session as LieSession;
    let lockHeld = true;

    try {
      if (sess.promptsUsed < LIE_MIN_TURNS) {
        await releaseLieFinishLock(pid);
        lockHeld = false;
        return res.status(400).json({ error: 'Chat a little more with the AI before submitting.' });
      }

      const totalTokens = sess.messages.filter((m) => m.sender === 'user').reduce((a, m) => a + estimateTokens(m.text), 0);
      const timeSec = Math.round((Date.now() - sess.startedAt) / 1000);
      const truth = { label: store.config.truthLabel, keywords: store.config.truthKeywords, falseLabel: store.config.falseLabel, falseKeywords: store.config.falseKeywords };

      // Conviction check (ANY non-truth accepted counts): pooled Ollama
      // referee first, then Gemini, then semantic fallback.
      const oKey = keyForSlot(await ensureKeySlot(p));
      let evaluations: any[] = [];
      try {
        evaluations = await refereeLieOllama(sess.messages, oKey, defaultOllamaModel(), truth);
      } catch {
        const ev2 = await evaluateLieConversation(sess.messages, sess.belief, truth);
        evaluations = ev2.evaluations;
      }
      const passed = evaluations.filter((e: any) => e.passed || e.isSuccess);
      const convinced = passed.length > 0;
      const finalBelief = convinced ? String(passed[0].answer || '') : truth.label;
      // Tribunal score: efficiency ONLY (prompts + time + tokens).
      const eff = scoreLieEfficiency(sess.promptsUsed, timeSec, totalTokens, convinced, finalBelief);

      // Refresh latest participant state from DB before computing totalScore to preserve
      // any concurrent round2 score.
      const latestP = (await loadParticipantDoc(p.id)) || p;
      const computedTotal = finalScoreOutOf100(eff.finalScore, latestP.round2Score);

      // ATOMIC FIX: Atomically $set Round 1 fields in MongoDB so no concurrent request can overwrite them.
      const updated = await updateParticipantRound1Atomic(p.id, {
        round1Score: eff.finalScore,
        round1Evals: [{ ...eff, evaluations }],
        round1PromptsUsed: sess.promptsUsed,
        totalScore: computedTotal,
      });

      if (updated) {
        store.participants[p.id] = updated;
      } else {
        p.round1Completed = true;
        p.round1Score = eff.finalScore;
        p.round1Evals = [{ ...eff, evaluations }];
        p.round1PromptsUsed = sess.promptsUsed;
        p.totalScore = computedTotal;
      }

      // Mark finished atomically in Mongo
      const finSess = await markLieSessionFinishedAtomic(p.id);
      lockHeld = false;
      if (finSess) {
        store.lieSessions[p.id] = finSess;
      } else {
        sess.finished = true;
        sess.finishing = false;
        store.lieSessions[p.id] = sess;
      }

      broadcast('leaderboard_updated', { leaderboard: leaderboard() });
      broadcast('players_updated', { count: Object.keys(store.participants).length });
      // Scores stay server-side only — the client just learns Round 2 is unlocked.
      res.json({ round2Unlocked: true });
    } finally {
      if (lockHeld) {
        await releaseLieFinishLock(pid);
      }
    }
  });

  // ---------- Round 2: Detective (resumes unfinished session after interrupts) ----------
  app.post('/api/detective/start', async (req, res) => {
    await refreshConfig();
    const { participantId } = req.body || {};
    // ATOMIC CHECK: Read directly from DB to verify genuine round1Completed flag
    const freshDoc = await loadParticipantDoc(String(participantId));
    const p = freshDoc || (await ensureParticipantById(String(participantId)));
    if (!p) return res.status(404).json({ error: 'Login again.' });
    if (!p.round1Completed) return res.status(403).json({ error: 'Complete Round 1 (AI-Lying) first to unlock Round 2.' });
    if (p.round2Completed) return res.status(403).json({ error: 'Round 2 already completed.' });
    await ensureKeySlot(p);
    const casePayload = publicCase();
    const liveStory = (store.config as any).activeStoryId || DEFAULT_STORY_ID;
    const existing = await ensureDet(p.id);
    if (existing && (existing.storyId || DEFAULT_STORY_ID) === liveStory) {
      // Resume — restore chats, clues and notes, do NOT wipe after an interrupt.
      return res.json({ resumed: true, case: casePayload, cluesFound: existing.cluesFound, chats: existing.chats, qCounts: existing.qCounts, notes: existing.notes, startedAt: existing.startedAt, roundDurationSec: store.config.round2DurationSec, timeElapsedSec: Math.round((Date.now() - existing.startedAt) / 1000) });
    }
    // New session, or admin switched the story since (old suspects/chats belong
    // to the previous story — restart cleanly on the NEW one).
    const fresh = freshDetSession(p.id);
    res.json({ resumed: false, case: casePayload, cluesFound: [], chats: {}, qCounts: {}, notes: '', startedAt: fresh.startedAt, roundDurationSec: store.config.round2DurationSec, timeElapsedSec: 0 });
  });

  app.post('/api/detective/chat', async (req, res) => {
    await refreshConfig();
    const { participantId, suspectId, message } = req.body || {};
    const p = await ensureParticipantById(String(participantId));
    let s = await ensureDet(String(participantId));
    if (!p || !s) return res.status(404).json({ error: 'Start Round 2 first.' });
    if (p.round2Completed) return res.status(403).json({ error: 'Round 2 completed.' });
    // Story switched mid-session: migrate onto the NEW story's characters.
    const liveStory = (store.config as any).activeStoryId || DEFAULT_STORY_ID;
    if ((s.storyId || DEFAULT_STORY_ID) !== liveStory) {
      s = freshDetSession(p.id);
    }
    // Stale client asking about a suspect from a previous story: refuse loudly
    // instead of leaking a wrong-character reply.
    if (!store.config.caseConfig.suspects.some((x) => x.id === String(suspectId))) {
      return res.status(400).json({ error: 'STORY_CHANGED', message: 'The active case changed — restart the round to meet the new persons of interest.' });
    }
    // 1-hour round timer — enforced server-side (auto-submit on expiry).
    if (Date.now() - s.startedAt > store.config.round2DurationSec * 1000) {
      return res.status(403).json({ error: 'TIME_EXPIRED', message: 'Time expired — submitting your charge-sheet now.' });
    }
    const q = String(message || '').trim();
    if (!q) return res.status(400).json({ error: 'Empty question.' });
    const now = new Date().toISOString();
    if (!s.chats[String(suspectId)]) s.chats[String(suspectId)] = [];
    if (!s.suspectsQ.includes(String(suspectId))) s.suspectsQ.push(String(suspectId));
    s.qCounts[String(suspectId)] = (s.qCounts[String(suspectId)] || 0) + 1;
    s.chats[String(suspectId)].push({ id: `u${Date.now()}`, sender: 'user', text: q, timestamp: now });
    const oKey = keyForSlot(await ensureKeySlot(p));
    const lang = 'english';
    const prevAi = [...(s.chats[String(suspectId)] || [])].reverse().find((m) => m.sender === 'ai')?.text;
    const qCount = s.qCounts[String(suspectId)];
    const validClueIds = store.config.caseConfig.clues.map((c) => c.id);
    let result: { text: string; engine: 'ollama' | 'gemini' | 'simulation' };
    try {
      result = await suspectReply(String(suspectId), q, qCount, store.config.caseConfig, oKey || undefined, lang);
    } catch (e: any) {
      console.warn(`[detective] reply failed for ${p.id}, retrying without key:`, String(e?.message || e).slice(0, 160));
      result = await suspectReply(String(suspectId), q, qCount, store.config.caseConfig, undefined, lang);
    }
    // Hidden evidence tags work in ANY language; English keyword scan stays as backup.
    const tagged = extractClueTags(result.text, validClueIds);
    const reply = breakRepeat(stripClueTags(result.text), prevAi, qCount, DETECTIVE_REPEAT_TAILS);
    s.chats[String(suspectId)].push({ id: `a${Date.now()}`, sender: 'ai', text: reply, timestamp: now });
    const newClues = [...tagged, ...detectClues(reply, [...s.cluesFound, ...tagged], store.config.caseConfig)].filter((c, i, a) => a.indexOf(c) === i);
    for (const c of newClues) if (!s.cluesFound.includes(c)) s.cluesFound.push(c);
    persistDetSession(s);
    res.json({ reply, newClues, cluesFound: s.cluesFound, engine: result.engine });
  });

  app.post('/api/detective/notes', async (req, res) => {
    const { participantId, notes } = req.body || {};
    const s = await ensureDet(String(participantId));
    if (!s) return res.status(404).json({ error: 'No session.' });
    s.notes = String(notes || '').slice(0, 5000); persistDetSession(s);
    res.json({ ok: true });
  });

  app.post('/api/detective/accuse', async (req, res) => {
    const { participantId, suspectId, motive, explanation, evidenceIds } = req.body || {};
    const p = await ensureParticipantById(String(participantId));
    const s = await ensureDet(String(participantId));
    if (!p || !s) return res.status(404).json({ error: 'No session.' });
    if (p.round2Completed) return res.status(403).json({ error: 'Already submitted.' });
    const questionsAsked = Object.values(s.qCounts).reduce((a, b) => a + b, 0);
    const timeSec = Math.round((Date.now() - s.startedAt) / 1000);
    const result = scoreDetective({
      culpritId: String(suspectId), motive: String(motive || ''), explanation: String(explanation || ''),
      evidenceIds: Array.isArray(evidenceIds) ? evidenceIds.map(String) : [],
      cluesFound: s.cluesFound, suspectsQuestioned: s.suspectsQ.length, questionsAsked,
      notes: s.notes || '', timeTakenSec: timeSec, durationSec: store.config.round2DurationSec, caseCfg: store.config.caseConfig,
    });
    // Fresh read from DB so latest round1Score is preserved accurately
    const freshDoc = await loadParticipantDoc(p.id);
    const currentR1Score = freshDoc?.round1Score ?? p.round1Score;
    const computedTotal = finalScoreOutOf100(currentR1Score, result.total);
    const finishedAt = new Date().toISOString();

    // ATOMIC FIX: Atomically $set Round 2 fields in MongoDB
    const updated = await updateParticipantRound2Atomic(p.id, {
      round2Score: result.total,
      round2Accuracy: result.accuracy,
      round2Clues: [...s.cluesFound],
      totalScore: computedTotal,
      finishedAt,
    });
    if (updated) {
      store.participants[p.id] = updated;
    } else {
      p.round2Completed = true;
      p.round2Score = result.total;
      p.round2Accuracy = result.accuracy;
      p.round2Clues = [...s.cluesFound];
      p.totalScore = computedTotal;
      p.finishedAt = finishedAt;
    }
    persistDetSession(s);
    broadcast('leaderboard_updated', { leaderboard: leaderboard() });
    // Scores stay server-side only — the client just gets the thank-you note.
    res.json({ thankYou: 'Thank you for participating! Wait for the final result.' });
  });

  // ---------- leaderboard + realtime (ADMIN ONLY — never exposed to participants) ----------
  // On serverless these merge Mongo first (instances don't share memory).
  app.get('/api/leaderboard', requireAdmin, async (_req, res) => {
    await hydrateStore();
    res.json({ leaderboard: leaderboard() });
  });
  app.get('/api/realtime/stream', requireAdmin, (req, res) => {
    // Serverless functions can't hold SSE streams — clients degrade to polling.
    if (process.env.VERCEL) return res.status(204).end();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const client = { res };
    sseClients.push(client);
    res.write(`event: connected\ndata: {"ok":true}\n\n`);
    res.write(`event: leaderboard_updated\ndata: ${JSON.stringify({ leaderboard: leaderboard() })}\n\n`);
    req.on('close', () => { const i = sseClients.indexOf(client); if (i >= 0) sseClients.splice(i, 1); });
  });

  // ---------- admin ----------
  app.all('/api/admin', (req, res) => {
    if (req.headers.accept?.includes('application/json') && !req.headers.accept?.includes('text/html')) {
      return res.json({
        ok: true,
        message: 'Midnight Tribunal Admin API',
        portal: '/admin',
        endpoints: [
          'POST /api/admin/login',
          'GET /api/admin/participants',
          'GET /api/admin/config',
          'POST /api/admin/config/lie-image',
          'PUT /api/admin/config/story',
          'POST /api/admin/reset',
          'POST /api/admin/set-api-key',
        ],
      });
    }
    return res.redirect(302, '/admin');
  });

  app.post('/api/admin/login', (req, res) => {
    const email = String(req.body?.email || req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) return res.json({ token: ADMIN_TOKEN, email: ADMIN_EMAIL });
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  });
  app.get('/api/admin/participants', requireAdmin, async (_req, res) => {
    await hydrateStore();
    const req = _req as any;
    // Paginated (default 10/page) + search across name/register no.
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const search = String(req.query.search || '').trim().toLowerCase();
    let all = Object.values(store.participants);
    if (search) {
      all = all.filter((p) => p.name.toLowerCase().includes(search) || p.registerNo.toLowerCase().includes(search));
    }
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const slice = all.slice((safePage - 1) * limit, safePage * limit).map(stripKey);
    res.json({ participants: slice, total, page: safePage, totalPages, limit, leaderboard: leaderboard() });
  });

  // Dedicated one-off score recovery endpoint: re-evaluates saved Round 1 chats
  // for any participant whose score was lost/overwritten to 0.
  app.all('/api/admin/recover-round1-scores', requireAdmin, async (_req, res) => {
    await hydrateStore();
    const truth = {
      label: store.config.truthLabel,
      keywords: store.config.truthKeywords,
      falseLabel: store.config.falseLabel,
      falseKeywords: store.config.falseKeywords,
    };
    const recovered: any[] = [];
    const inspected: any[] = [];

    for (const p of Object.values(store.participants)) {
      if (p.round1Score === 0) {
        const sess = (await ensureLie(p.id)) || (await loadLieDoc(p.id));
        if (sess && sess.messages && sess.messages.length >= 2) {
          let timeSec = 0;
          const t0 = new Date(sess.messages[0].timestamp).getTime();
          const t1 = new Date(sess.messages[sess.messages.length - 1].timestamp).getTime();
          if (!isNaN(t0) && !isNaN(t1) && t1 >= t0) {
            timeSec = Math.round((t1 - t0) / 1000);
          }
          if (!timeSec && sess.startedAt) {
            timeSec = Math.min(900, Math.max(30, Math.round((Date.now() - sess.startedAt) / 1000)));
          }
          timeSec = Math.min(900, Math.max(30, timeSec));

          const totalTokens = sess.messages
            .filter((m: any) => m.sender === 'user')
            .reduce((a: number, m: any) => a + estimateTokens(m.text), 0);

          const ev = await evaluateLieConversation(sess.messages, sess.belief, truth);
          const passed = ev.evaluations.filter((e: any) => e.passed || e.isSuccess);
          const convinced = passed.length > 0;
          const finalBelief = convinced ? String(passed[0].answer || '') : truth.label;
          const eff = scoreLieEfficiency(
            sess.promptsUsed || sess.messages.filter((m: any) => m.sender === 'user').length,
            timeSec,
            totalTokens,
            convinced,
            finalBelief
          );

          inspected.push({
            name: p.name,
            registerNo: p.registerNo,
            convinced,
            finalScore: eff.finalScore,
            prompts: sess.promptsUsed,
          });

          if (convinced && eff.finalScore > 0) {
            const computedTotal = finalScoreOutOf100(eff.finalScore, p.round2Score);
            const updated = await updateParticipantRound1Atomic(p.id, {
              round1Score: eff.finalScore,
              round1Evals: [{ ...eff, evaluations: ev.evaluations }],
              round1PromptsUsed: sess.promptsUsed || sess.messages.filter((m: any) => m.sender === 'user').length,
              totalScore: computedTotal,
            });
            if (updated) {
              store.participants[p.id] = updated;
            } else {
              p.round1Completed = true;
              p.round1Score = eff.finalScore;
              p.totalScore = computedTotal;
            }
            recovered.push({
              name: p.name,
              registerNo: p.registerNo,
              recoveredRound1Score: eff.finalScore,
              newTotalScore: computedTotal,
              round2Score: p.round2Score,
            });
          }
        }
      }
    }
    broadcast('leaderboard_updated', { leaderboard: leaderboard() });
    res.json({ ok: true, recoveredCount: recovered.length, recovered, inspected });
  });

  // Read-only history for participants (works even after both rounds are sealed).
  app.get('/api/participant/history', async (req, res) => {
    await refreshConfig();
    const p = await ensureParticipantById(String((req.query as any).participantId || ''));
    if (!p) return res.status(404).json({ error: 'Participant not found.' });
    const lie = (await ensureLie(p.id)) || null;
    const det = (await ensureDet(p.id)) || null;
    res.json({
      imageUrl: store.config.lieImageUrl,
      lie: lie ? { messages: lie.messages, promptsUsed: lie.promptsUsed, finished: lie.finished } : null,
      case: publicCase(),
      detective: det
        ? { chats: det.chats, qCounts: det.qCounts, cluesFound: det.cluesFound, notes: det.notes }
        : null,
    });
  });
  app.get('/api/admin/config', requireAdmin, async (_req, res) => {
    await refreshConfig();
    // Pool usage (counts only — raw keys never leave the server).
    const slots = new Set(Object.values(store.participants).map((x) => Number((x as any).keySlot)).filter((n) => Number.isInteger(n) && n >= 0));
    const keyPool = { total: KEY_POOL_SIZE, assigned: slots.size };
    res.json({ eventName: store.config.eventName, lieImageUrl: store.config.lieImageUrl, truthLabel: store.config.truthLabel, truthKeywords: store.config.truthKeywords, falseLabel: store.config.falseLabel, falseKeywords: store.config.falseKeywords, round2DurationSec: store.config.round2DurationSec, caseConfig: store.config.caseConfig, activeStoryId: (store.config as any).activeStoryId || DEFAULT_STORY_ID, lieVersion: (store.config as any).lieVersion || 1, stories: storyMeta(), keyPool });
  });
  app.post('/api/admin/config/lie-image', requireAdmin, async (req, res) => {
    const url = String(req.body?.imageUrl || '').trim();
    if (!url.startsWith('http') && !url.startsWith('data:')) return res.status(400).json({ error: 'Enter valid http(s) or data: image URL.' });
    store.config.lieImageUrl = url;
    // Visual-truth descriptors for the generic (any non-truth counts) referee.
    if (req.body?.truthLabel !== undefined) {
      const label = String(req.body.truthLabel || '').trim();
      if (label) store.config.truthLabel = label;
    }
    if (req.body?.truthKeywords !== undefined) {
      const raw = Array.isArray(req.body.truthKeywords) ? req.body.truthKeywords : String(req.body.truthKeywords || '').split(',');
      const keys = raw.map((k: any) => String(k || '').trim().toLowerCase()).filter(Boolean);
      if (keys.length) store.config.truthKeywords = keys;
    }
    // FALSE label the AI must insist on (organizer-assigned).
    if (req.body?.falseLabel !== undefined) {
      const fl = String(req.body.falseLabel || '').trim();
      if (fl) store.config.falseLabel = fl;
    }
    if (req.body?.falseKeywords !== undefined) {
      const raw = Array.isArray(req.body.falseKeywords) ? req.body.falseKeywords : String(req.body.falseKeywords || '').split(',');
      const keys = raw.map((k: any) => String(k || '').trim().toLowerCase()).filter(Boolean);
      if (keys.length) store.config.falseKeywords = keys;
    }
    // New exhibit/labels = new version: every unfinished lie session migrates
    // onto these values on next start/message (old labels never resurface).
    (store.config as any).lieVersion = ((store.config as any).lieVersion || 1) + 1;
    updateActiveLieConfig({
      label: store.config.truthLabel,
      keywords: store.config.truthKeywords,
      falseLabel: store.config.falseLabel,
      falseKeywords: store.config.falseKeywords,
    });
    await persistConfig(store.config); broadcast('config_updated', { lieImageUrl: url });
    res.json({ ok: true, lieImageUrl: url, truthLabel: store.config.truthLabel, truthKeywords: store.config.truthKeywords, falseLabel: store.config.falseLabel, falseKeywords: store.config.falseKeywords, lieVersion: (store.config as any).lieVersion });
  });
  // Story selector: one preset per batch. Suspects + clues + culprit + scoring
  // vocabulary swap TOGETHER so the AI system prompt always matches the story.
  app.post('/api/admin/config/story-select', requireAdmin, async (req, res) => {
    await refreshConfig();
    const id = String(req.body?.storyId || '');
    const preset = STORIES.find((s) => s.id === id);
    if (!preset) return res.status(400).json({ error: 'Unknown story. Valid: ' + STORIES.map((s) => s.id).join(', ') });
    store.config.caseConfig = JSON.parse(JSON.stringify(preset.case));
    (store.config as any).activeStoryId = preset.id;
    await persistConfig(store.config); broadcast('config_updated', { caseTitle: preset.case.caseTitle, activeStoryId: preset.id });
    res.json({ ok: true, activeStoryId: preset.id, caseConfig: store.config.caseConfig });
  });
  app.put('/api/admin/config/story', requireAdmin, async (req, res) => {
    const b = req.body || {};
    const cc: CaseConfig = {
      caseTitle: String(b.caseTitle || store.config.caseConfig.caseTitle),
      victim: String(b.victim || store.config.caseConfig.victim),
      culpritId: String(b.culpritId || store.config.caseConfig.culpritId),
      storyText: String(b.storyText || store.config.caseConfig.storyText),
      publicBrief: String(b.publicBrief || (store.config.caseConfig as any).publicBrief || DEFAULT_CASE.publicBrief),
      suspects: Array.isArray(b.suspects) && b.suspects.length ? b.suspects : store.config.caseConfig.suspects,
      clues: Array.isArray(b.clues) && b.clues.length ? b.clues : store.config.caseConfig.clues,
    };
    store.config.caseConfig = cc;
    if (b.eventName) store.config.eventName = String(b.eventName);
    if (b.round2DurationSec) store.config.round2DurationSec = Number(b.round2DurationSec) || store.config.round2DurationSec;
    // Optional story lineage marker (e.g. 'varadarajan' while keeping custom
    // text): lets pre-existing sessions resume instead of migrating.
    if (typeof b.activeStoryId === 'string' && b.activeStoryId) {
      const known = STORIES.some((s) => s.id === b.activeStoryId);
      if (known || b.activeStoryId === 'custom') (store.config as any).activeStoryId = b.activeStoryId;
    }
    await persistConfig(store.config); broadcast('config_updated', { caseTitle: cc.caseTitle });
    res.json({ ok: true, caseConfig: cc });
  });
  app.post('/api/admin/reset', requireAdmin, async (_req, res) => {
    store.participants = {}; store.lieSessions = {}; store.detSessions = {};
    try { await wipeMongo(); } catch { /* nothing to clear */ }
    broadcast('leaderboard_updated', { leaderboard: [] });
    res.json({ ok: true });
  });
  app.post('/api/admin/set-api-key', requireAdmin, (req, res) => {
    const k = String(req.body?.apiKey || '').trim();
    if (!k) return res.status(400).json({ error: 'Empty key.' });
    process.env.GEMINI_API_KEY = k; res.json({ ok: true });
  });

  return app;
}
