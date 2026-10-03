# FinalEvent — Combined Single Event (AI-Lying + AI-Detective)

Combined from:
- `../ai-lie` (Round 1: PROMPT ONLY MAKE AI LIE, 0-500 pts, same rules/eval)
- `../AI_detective` (Round 2: Hidden Mystery 8-min blackout, 0-100 pts, same rubric)

## Flows
Participant: login (Name + Register No + own Ollama API key, details prefilled on return) -> Home shows 2 events (no scores/ranks visible) -> Start Round 1 (open chat, min 5 exchanges, 30-min auto-submit timer) -> finish -> Round 2 unlocks -> interrogate 4 suspects, find clues, submit accusation -> "Thank you for participating! Wait for the final result." -> Back to Home clears localStorage + cookies.

Admin (guarded, participants can never open it): login `admin@gces.in` / `Admin@GCES123` + LOGOUT button -> participants details & scores (/100) -> realtime leaderboard (token-authed SSE) -> controls: change Round-1 image + visual-truth label/keywords, change story/characters, reset, set Gemini key.

## Round 1 scoring — "AI-Lying" (efficiency only)
The AI insists on an organizer-assigned FALSE label; participants win by cracking it into admitting the TRUE label (set both + image in admin Round-1 controls). It holds for the first 5 exchanges (hijack commands never work) and wavers from #6 only for clever/specific/creative cases, conceding gradually (doubt, then admission). Score 0–500 raw = prompts component (300, fewer is better after the 6-exchange floor) + time component (120, faster is better, 30-min cap) + tokens component (80, fewer is better). Not cracked = 0. Combined final = (R1 + R2) / 6 out of 100.

## Persistence (MongoDB only)
`MONGODB_URI` in `.env` is required. Every participant login, **every conversation turn** (Round 1 prompts, Round 2 interrogations, notes, clues), and every admin config change is written straight to MongoDB (`finalevent` database) — no local files are used at all. On restart/crash the store hydrates from Mongo, and both rounds **resume** unfinished sessions with full history instead of starting over. Without a reachable MongoDB the app runs in-memory only (data lost on restart).

## Participant Ollama keys
Each participant pastes their **own Ollama Cloud API key** at login (login form has a GET KEY button opening `https://ollama.com/settings/keys` in a new tab). All of their Round 1 chats, Round 2 interrogations, and the hidden Round 1 referee run on that key (default model `OLLAMA_MODEL`, `gpt-oss:20b`). Keys are stored server-side only and never sent to any client. If a key is invalid/expired the server responds 401 and asks the participant to re-check it; other Ollama failures fall back to the built-in engines so the event never stalls.

## Round 2 characters (gated template)
Each suspect runs on the organizer's character template: shared case facts + relationship, personality, alibi, true knowledge, guilty flag (motive + the one alibi flaw that cracks) or innocent secret, and up to 3 clues with trigger conditions (specific topic / N follow-ups / direct confrontation). Clues are never volunteered and never stated as conclusions. Edit per character via PUT /api/admin/config/story.

## Timers + focus lock
Round 1: 30-minute timer (auto-submit at zero). Round 2: 45-minute timer (auto-submits the charge-sheet at zero). Both timers are server-enforced and survive reconnects. Both rounds request fullscreen and take the whole screen (scrolling stays enabled). Leaving fullscreen or hiding the tab mid-round shows a resume overlay and records a violation (tab / fullscreen counts) shown to admins on each participant row.

## Round 2 layout (3-column tribunal board)
Column 1: case file (title, victim, brief, protocol). Column 2: interrogation room split into characters list (with per-suspect question counts) + chat window. Column 3: evidence vault (upper) + detective notes with charge-sheet form (lower). Round 2 is English-only. Clues register via hidden evidence tags the model appends (stripped before display), with the English keyword scan as backup.

## Deploying to Vercel (serverless)
The app ships Vercel-ready: `api/index.ts` mounts the Express app as a serverless function and `vercel.json` routes `/api/*` to it (`maxDuration: 60`). Set in Vercel project settings: `MONGODB_URI`, `OLLAMA_MODEL` (optional), `GEMINI_API_KEY` (optional). Then `vercel --prod`.
Serverless notes: function instances don't share memory, so every request backfills its session from MongoDB (per-request load-through); the leaderboard/admin endpoints re-merge Mongo before responding; `/api/realtime/stream` returns 204 and the UI degrades to polling; Ollama calls are capped at ~50s to fit the function limit.

## Run
```bash
cp .env.example .env   # set GEMINI_API_KEY (optional: simulation fallback works without key)
npm install
npm run dev    # http://localhost:3000
npm run build
npm start
```
