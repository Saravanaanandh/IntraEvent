# R1 Score-Loss Race Fix — Verification Report (live Vercel endpoint)

- Target: `https://prompt-theory-gces.vercel.app` (production). Tested 2026-10-07.
- Scope: live site only, no code/config changed. Footprint: 4 labeled QA accounts
  (`Race Alpha/Beta/Cara/Dev`, regnos `QARACE01–04`) + their gameplay traffic. No real-user data touched.
- Question asked: did the atomic-write fix eliminate the "30–50 concurrent Round 1 submissions →
  scores silently reset to 0 + Round 2 stays locked" failure?

## 1. Fix reviewed (code, `src/server/db.ts` + `src/server/app.ts`)

- New atomic helpers: `updateParticipantAtomic`, `recordViolationAtomic` (`$inc`),
  `updateParticipantRound1Atomic` / `updateParticipantRound2Atomic` (targeted `$set` of score +
  completion + evals + total only), `updateParticipantFieldsAtomic`.
- `lie/finish`: re-reads participant from DB before totaling, then `$set`s R1 fields; in-memory copy
  refreshed from the atomic result. `detective/start` gate reads `round1Completed` straight from DB.
  Violation and login-year paths also atomic. Plus a remediation endpoint
  `POST /api/admin/recover-round1-scores`. The fix matches the described solution. No full-doc
  participant write remains on the hot paths (only new-account creation, which is safe).

## 2. Short testcase executed (the reported trigger, reproduced)

1. Log in 2 QA users, `lie/start` each (fresh sessions, 15-min timer).
2. Play 8 turns each (LIE_MIN_TURNS=8) to reach finish-eligibility.
3. Burst per user, all concurrent (11 reqs/user, 22 total): 3× `lie/finish` + 5× `violation` +
   1× `login` + 2× `history` — i.e. finishes racing each other while violations/logins fire,
   exactly the reported lost-update interleaving.
4. Verify via admin reads: `round1Completed`, `round1Score`; via `detective/start` (must be 200, not 403).
5. Soak ~25 s with further violation interference; re-read twice; assert stability.

## 3. Result: reported bug is FIXED — PASS

| Check | QARACE03 (Cara) | QARACE04 (Dev) |
|---|---|---|
| Finish burst (3 concurrent) | 3× 200 `round2Unlocked:true` | 3× 200 `round2Unlocked:true` |
| Violations / login / history in burst | all 200, zero errors | all 200, zero errors |
| `round1Completed` after burst | true | true |
| `round1Score` after burst | 0 | 487 |
| `detective/start` (R2 gate) | 200 — unlocked | 200 — unlocked |
| After 25 s soak + 6 more violations | unchanged (true / 0) | unchanged (true / 487) |

- The `0` for Cara is a **genuine computed score, not data loss**: `scoreLieEfficiency` returns 0 by
  design when `convinced=false`, and her stored `round1Evals` audit trail shows all 5 referee evals
  failed (AI never admitted; 8 turns, unconvinced). Dev's 487 likewise genuine (convinced).
- Completion flag and score were written together atomically and never regressed across 3 reads
  spanning interference. No 0-reset, no false lock, no 5xx anywhere in the run.

**Verdict on the asked question: YES — the concurrent-submission score loss is fixed.**

## 4. Residual finding (same bug family, NOT covered by this fix) — HIGH

**Round 1 chat turns are silently lost under rapid sequential requests** (session docs still use
fire-and-forget full-doc upserts + memory-first reads across serverless instances):

- User Alpha: 8× 200-OK turns → server retained **1** message (`promptsUsed=1`).
- Users Cara/Dev (1.5 s gaps): turn counters went 1,2,3,**2**,3,4,5,6 and 1,2,**1**,2,3,3,4,5 —
  mid-play resets/stalls; history re-reads oscillated (6→4→5) seconds apart, i.e. divergent
  per-instance forks, last-writer-wins.
- One stored AI reply is truncated mid-word (`"It's a beautiful pe"`); one transient 200 response
  began `"We must comply with the developer message…"` but that fork was overwritten before it
  could be re-read (single sample — recommend checking server logs for the full text).
- Impact: reaching the 8-turn finish gate is a lottery under load; the referee scores divergent
  forks. This is gameplay-visible and will bite at 30–50 concurrent players.
- Recommended fix (same pattern as this fix): `await` session persists and/or atomic `$push` of
  messages + `$inc` of the turn counter; memory-first session reads need version/mtime guard.

## 5. Secondary observations

- Violation counts lost under burst (5 fired → 1–2 stored): when atomic `$inc` returns null
  (instance not yet connected) the fallback mutates memory without persisting. Low severity
  (violations gate nothing) but same disease.
- Per-turn engine flapped `ollama`/`simulation` throughout — pooled Ollama calls intermittently
  fail and fall back silently. Game continues, but AI quality degrades without surfacing it.
- Each `lie/finish` runs a full referee pass (~10–30 s observed); concurrent double-submits
  multiply that cost and last-writer-wins the score. Consider finish idempotency.
- Evidence: `C:\Users\saravana\AppData\Local\Temp\opencode\qa\race_play.json`,
  `race_play2.json`, `race_burst.json`, `race_ids*.json`.

## 6. Bottom line

- **Shipped fix: VERIFIED.** Concurrent R1 submissions no longer lose scores or lock Round 2
  (both completion flags, both scores incl. a genuine 0, R2 gate, stability — all correct).
- **Do not consider the race class closed**: the session-turn loss (§4) reproduces on demand with
  sequential traffic and should be fixed before the event; otherwise expect under-counted turns,
  erratic `promptsUsed`, and referee-on-partial-history at load.
