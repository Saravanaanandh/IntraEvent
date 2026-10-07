// MongoDB persistence (Mongoose) — the ONLY store. Every user login,
// every conversation turn, and every admin config change is written here.
// On boot the in-memory store is hydrated from Mongo; on any interrupt,
// sessions resume from Mongo with full history. No local files are used.
import mongoose from 'mongoose';
import type { Participant } from '../types.js';

// Env is read lazily (mongoUri) because ES imports evaluate before dotenv.config().
function mongoUri(): string {
  return process.env.MONGODB_URI || '';
}
let connected = false;
let connectAttempted = false;

const docSchema = new mongoose.Schema(
  {
    pid: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

const ParticipantDoc = mongoose.models.FEParticipant || mongoose.model('FEParticipant', docSchema);
const LieSessionDoc = mongoose.models.FELieSession || mongoose.model('FELieSession', docSchema);
const DetSessionDoc = mongoose.models.FEDetSession || mongoose.model('FEDetSession', docSchema);
const ConfigDoc = mongoose.models.FEConfig || mongoose.model('FEConfig', docSchema);

export function isMongoEnabled(): boolean {
  return Boolean(mongoUri());
}

export function isMongoUp(): boolean {
  return connected;
}

// Cached connection: on serverless (Vercel), warm invocations reuse it
// instead of opening a new connection per request.
let connectPromise: Promise<boolean> | null = null;

export function connectMongo(): Promise<boolean> {
  if (connected) return Promise.resolve(true);
  if (!connectPromise) connectPromise = doConnect().catch(() => false);
  return connectPromise;
}

async function doConnect(): Promise<boolean> {
  const mongoUrl = mongoUri();
  if (!mongoUrl) {
    console.warn('[mongo] MONGODB_URI not set - running IN-MEMORY ONLY (data will be lost on restart).');
    connectPromise = null;
    return false;
  }
  try {
    await mongoose.connect(mongoUrl, {
      dbName: 'finalevent',
      serverSelectionTimeoutMS: 8000,
    });
    connected = true;
    console.log('[mongo] connected - the ONLY store (users + conversations + config).');
    return true;
  } catch (e: any) {
    console.warn('[mongo] connection failed - running IN-MEMORY ONLY:', String(e?.message || e).slice(0, 200));
    connected = false;
    connectPromise = null;
    return false;
  }
}

async function upsert(model: mongoose.Model<any>, pid: string, data: any) {
  if (!connected) return;
  try {
    await model.findOneAndUpdate({ pid }, { pid, data }, { upsert: true }).exec();
  } catch (e: any) {
    console.warn(`[mongo] persist failed for ${pid}:`, String(e?.message || e).slice(0, 150));
  }
}

/**
 * RACE CONDITION FIX:
 * Previously, all updates wrote the full in-memory participant object via
 * findOneAndUpdate({ pid }, { pid, data: p }).
 * When multiple requests arrived close together (e.g. participant finishes Round 1
 * while focus-lock violation events or Round 2 requests fire), a concurrent request
 * reading a stale participant copy would overwrite newly-saved Round 1 scores back to 0.
 *
 * THE FIX:
 * Atomic findOneAndUpdate operations using targeted `$set` and `$inc`.
 * Each write modifies ONLY its specific fields in MongoDB, never replacing
 * the full document.
 */

// Atomic field updater for participant documents
export async function updateParticipantAtomic(pid: string, updateQuery: mongoose.UpdateQuery<any>): Promise<Participant | null> {
  if (!connected) return null;
  try {
    const d = await ParticipantDoc.findOneAndUpdate(
      { pid },
      updateQuery,
      { new: true }
    ).lean().exec();
    return ((d as any)?.data as Participant) ?? null;
  } catch (e: any) {
    console.warn(`[mongo] atomic update failed for ${pid}:`, String(e?.message || e).slice(0, 150));
    return null;
  }
}

// Atomically record tab / fullscreen violations using $inc so concurrent
// violation events never overwrite scores or progress.
export async function recordViolationAtomic(pid: string, kind: 'tab' | 'fs'): Promise<{ tabHidden: number; fullscreenExit: number } | null> {
  if (!connected) return null;
  const field = kind === 'tab' ? 'data.violations.tabHidden' : 'data.violations.fullscreenExit';
  try {
    const d = await ParticipantDoc.findOneAndUpdate(
      { pid },
      { $inc: { [field]: 1 } },
      { new: true }
    ).lean().exec();
    return (d as any)?.data?.violations ?? null;
  } catch (e: any) {
    console.warn(`[mongo] violation $inc failed for ${pid}:`, String(e?.message || e).slice(0, 150));
    return null;
  }
}

// Atomically save Round 1 score and completion flag.
export async function updateParticipantRound1Atomic(
  pid: string,
  scoreData: { round1Score: number; round1Evals: any[]; round1PromptsUsed: number; totalScore: number }
): Promise<Participant | null> {
  if (!connected) return null;
  try {
    const d = await ParticipantDoc.findOneAndUpdate(
      { pid },
      {
        $set: {
          'data.round1Completed': true,
          'data.round1Score': scoreData.round1Score,
          'data.round1Evals': scoreData.round1Evals,
          'data.round1PromptsUsed': scoreData.round1PromptsUsed,
          'data.totalScore': scoreData.totalScore,
        },
      },
      { new: true }
    ).lean().exec();
    return ((d as any)?.data as Participant) ?? null;
  } catch (e: any) {
    console.warn(`[mongo] round1 atomic update failed for ${pid}:`, String(e?.message || e).slice(0, 150));
    return null;
  }
}

// Atomically save Round 2 score and completion flag.
export async function updateParticipantRound2Atomic(
  pid: string,
  scoreData: { round2Score: number; round2Accuracy: number; round2Clues: string[]; totalScore: number; finishedAt: string }
): Promise<Participant | null> {
  if (!connected) return null;
  try {
    const d = await ParticipantDoc.findOneAndUpdate(
      { pid },
      {
        $set: {
          'data.round2Completed': true,
          'data.round2Score': scoreData.round2Score,
          'data.round2Accuracy': scoreData.round2Accuracy,
          'data.round2Clues': scoreData.round2Clues,
          'data.totalScore': scoreData.totalScore,
          'data.finishedAt': scoreData.finishedAt,
        },
      },
      { new: true }
    ).lean().exec();
    return ((d as any)?.data as Participant) ?? null;
  } catch (e: any) {
    console.warn(`[mongo] round2 atomic update failed for ${pid}:`, String(e?.message || e).slice(0, 150));
    return null;
  }
}

// Atomically update specific scalar fields (e.g. year, keySlot)
export async function updateParticipantFieldsAtomic(pid: string, fields: Partial<Participant>): Promise<Participant | null> {
  if (!connected) return null;
  const setFields: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    setFields[`data.${k}`] = v;
  }
  try {
    const d = await ParticipantDoc.findOneAndUpdate(
      { pid },
      { $set: setFields },
      { new: true }
    ).lean().exec();
    return ((d as any)?.data as Participant) ?? null;
  } catch (e: any) {
    console.warn(`[mongo] fields atomic update failed for ${pid}:`, String(e?.message || e).slice(0, 150));
    return null;
  }
}

// Fire-and-forget write-through helpers (safe to call without await).
export function persistParticipant(p: Participant) {
  void upsert(ParticipantDoc, p.id, p);
}
export function persistLieSession(sess: any) {
  if (sess?.participantId) void upsert(LieSessionDoc, sess.participantId, sess);
}
export function persistDetSession(sess: any) {
  if (sess?.participantId) void upsert(DetSessionDoc, sess.participantId, sess);
}
export function persistConfig(cfg: any) {
  // Returned (not void): admin mutation endpoints AWAIT this so the write has
  // landed before any subsequent refreshConfig() re-read can observe it.
  return upsert(ConfigDoc, 'global', cfg);
}

// Export Mongoose models for direct administrative queries
export { ParticipantDoc, LieSessionDoc, DetSessionDoc, ConfigDoc };

export async function wipeMongo() {
  if (!connected) return;
  await Promise.all([
    ParticipantDoc.deleteMany({}).exec(),
    LieSessionDoc.deleteMany({}).exec(),
    DetSessionDoc.deleteMany({}).exec(),
    // NOTE: global event config is intentionally kept across resets.
  ]);
}

export async function loadAllFromMongo(): Promise<{
  participants: Record<string, Participant>;
  lieSessions: Record<string, any>;
  detSessions: Record<string, any>;
  config: any | null;
} | null> {
  if (!connected) return null;
  try {
    const [ps, ls, ds, cs] = await Promise.all([
      ParticipantDoc.find({}).lean().exec(),
      LieSessionDoc.find({}).lean().exec(),
      DetSessionDoc.find({}).lean().exec(),
      ConfigDoc.findOne({ pid: 'global' }).lean().exec(),
    ]);
    const participants: Record<string, Participant> = {};
    const lieSessions: Record<string, any> = {};
    const detSessions: Record<string, any> = {};
    for (const d of ps) participants[d.pid] = d.data as Participant;
    for (const d of ls) lieSessions[d.pid] = d.data;
    for (const d of ds) detSessions[d.pid] = d.data;
    return { participants, lieSessions, detSessions, config: cs?.data ?? null };
  } catch (e: any) {
    console.warn('[mongo] hydrate failed:', String(e?.message || e).slice(0, 150));
    return null;
  }
}

// Single-doc loaders for serverless load-through: one request may land on a
// warm instance that never saw this participant's session in memory.
async function findDoc(model: mongoose.Model<any>, pid: string): Promise<any | null> {
  if (!connected) return null;
  try {
    const d = await model.findOne({ pid }).lean().exec();
    return (d as any)?.data ?? null;
  } catch {
    return null;
  }
}

export function loadParticipantDoc(pid: string): Promise<Participant | null> {
  return findDoc(ParticipantDoc, pid) as Promise<Participant | null>;
}

export async function loadParticipantByRegNo(registerNo: string): Promise<Participant | null> {
  if (!connected) return null;
  try {
    const d = await ParticipantDoc.findOne({ 'data.registerNo': registerNo }).lean().exec();
    return ((d as any)?.data as Participant) ?? null;
  } catch {
    return null;
  }
}

export function loadLieDoc(pid: string): Promise<any | null> {
  return findDoc(LieSessionDoc, pid);
}

export function loadDetDoc(pid: string): Promise<any | null> {
  return findDoc(DetSessionDoc, pid);
}

// Global event config doc (admin controls) — re-read on demand so admin
// updates go live on every serverless instance, not just boot time.
export async function loadConfigDoc(): Promise<any | null> {
  if (!connected) return null;
  try {
    const d = await ConfigDoc.findOne({ pid: 'global' }).lean().exec();
    return (d as any)?.data ?? null;
  } catch {
    return null;
  }
}

const counterSchema = new mongoose.Schema(
  {
    pid: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);
const CounterDoc = mongoose.models.FECounter || mongoose.model('FECounter', counterSchema);

// Round-robin slot allocator for the shared Ollama key pool. Atomic
// findOneAndUpdate so concurrent logins on serverless instances each take
// the next slot. Falls back to random on any failure.
export async function nextKeySlot(poolSize: number): Promise<number> {
  const size = Math.max(1, Math.floor(poolSize || 1));
  try {
    if (!connected) throw new Error('offline');
    const d = await CounterDoc.findOneAndUpdate(
      { pid: 'keyslot' },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean().exec();
    const seq = Number((d as any)?.seq ?? 1);
    return ((seq - 1) % size + size) % size;
  } catch {
    return Math.floor(Math.random() * size);
  }
}
