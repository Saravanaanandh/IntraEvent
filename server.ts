import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { buildApp, hydrateStore } from './src/server/app.js';
import { connectMongo, isMongoUp } from './src/server/db.js';

dotenv.config();
// Server entry with atomic MongoDB operations

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const isDev = process.env.NODE_ENV !== 'production';

async function main() {
  await connectMongo();
  await hydrateStore();
  console.log(`[store] persistence: mongo=${isMongoUp() ? 'ON' : 'OFF (file fallback)'}`);
  const app = buildApp();

  if (isDev) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(__dirname, 'dist');
    if (fs.existsSync(dist)) {
      app.use(express.static(dist));
      app.get('/{*any}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
    }
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`FinalEvent running on http://localhost:${PORT}`));
}

main();
