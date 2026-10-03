// Vercel serverless entry — all /api/* routes land here (see vercel.json).
// The Express app is mounted directly; each invocation is stateless, so all
// state flows through MongoDB (per-request load-through in src/server/app.js).
// Realtime SSE is unavailable on serverless — clients degrade to polling.
import { buildApp } from '../src/server/app.js';
import { connectMongo } from '../src/server/db.js';

const app = buildApp();

let ready: Promise<unknown> | null = null;

export default async function handler(req: any, res: any) {
  if (!ready) {
    ready = connectMongo().catch(() => false);
  }
  await ready;
  return (app as any)(req, res);
}
