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
  void upsert(ConfigDoc, 'global', cfg);
}

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
