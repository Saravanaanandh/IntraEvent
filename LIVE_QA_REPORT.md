# LIVE QA REPORT — prompt-theory-gces.vercel.app ("Midnight Tribunal" / PROMPT THEORY)

- Target: `https://prompt-theory-gces.vercel.app` (production, Vercel). Tested 2026-10-06 ~15:00–17:30 UTC.
- Scope: live site ONLY. No code/config changed. Read-only except creating clearly-labeled QA participant
  accounts (`Qabot *`, `Qaload *`, regnos `QAT*`/`QALB*`) with FAKE Ollama keys, as instructed. No real keys used.
- Method: manual recon + headless-Chromium participant walkthrough (Playwright) + Node API probes +
  controlled load waves 5 → 10 → 25 → 50 (staggered) + 50-burst (zero stagger).
- Volume: 980 load-phase requests + ~60 functional/security probes. Zero uncontrolled flooding
  (max 50 concurrent, small JSON bodies, 20–30 s cooldowns between waves).
- Secrets policy: this report describes vulnerabilities WITHOUT reprinting credentials, keys, or story spoilers.

## 1. Overall result

The site is up and the core participant journey works (login → event select → R1 arena → errors → logout),
and Vercel absorbed 50-concurrent bursts with zero HTTP 5xx. **But three critical findings fail the event:**
(1) the admin email+password are printed on the public `/admin` page — anyone can take over the event
(admin login verified working with those credentials); (2) `GET /api/config` with no auth returns the full
murder solution + every clue description; (3) participant APIs have no ownership checks — anyone holding a
participant ID can read/write that user's game. On top of that, the history endpoint times out at 50
concurrent, and live-AI behavior (the actual game) could not be verified at all without a valid key.
Nothing below is guessed — every claim cites observed evidence.

## 2. Functional testing (observed)

PASS:
- Health `GET /api` → 200 `{"ok":true,"service":"Midnight Tribunal API","status":"online"}` (~0.6–0.8 s).
- Participant login validates input: bad name/short regno/missing-or-short key → 400 with clear messages.
  Login response contains identity + progress flags only — no key echo, no scores. (T2)
- RegisterNo+name binding enforced: same regno + different name → 401; same identity + new key → 200
  key-refresh on the same participant ID. (T2)
- Round gating enforced server-side: `detective/start` before R1 → 403; `detective/chat` without session → 404;
  `lie/finish` under 6 prompts → 400; R1 30-min timer enforced (expired session → 403 `TIME_EXPIRED`, T10).
- Full UI walkthrough in headless Chromium: landing → enrollment (name/regno/year/key + GET KEY link) →
  home (R1 OPEN / R2 LOCKED) → START ROUND 1 → arena with live countdown (29:56 → ticking), EXCHANGES/TOKENS
  counters → invalid-key error rendered inline in chat → LOGOUT clears localStorage+cookies, back to hero. (T5/T6)
- Rapid double-Enter + double-Send click produced exactly ONE `/api/lie/message` request (`busy` guard works).
  No duplicate requests. (T6: `MSG-CALLS-AFTER-RAPID-SENDS: 1`)
- Malformed JSON → 400; 3 MB body → 413 (limit enforced); unknown routes → 404; empty-body calls → clean 404s. (T7)
- Returning-participant resume path exists in API (`resumed:true` with messages).

FAIL / RISKS:
- R1 is unplayable with an invalid key: every `lie/message` → 401 `Invalid Ollama API key…` in ~0.35–0.4 s,
  with NO fallback (Gemini/simulation only trigger on non-401 failures). Login accepts any ≥8-char string, so
  a typo'd key is discovered only at first send, mid-round. (B7)
- Failed (401) user prompts stay visible in the conversation (history showed 1 stored user message,
  `promptsUsed` un-incremented). (B9)
- `TIME_EXPIRED` says "submitting your round now" but nothing auto-submits; `lie/finish` can still 400
  (min-turns), leaving an expired round in a dead end. (B10)
- Deployed UI copy differs from current source (`ENTER CHALLENGE` vs `ENTER THE TRIBUNAL →`,
  `MAKE IT LIE / PERSUASION CHANNEL` wording) — production is running a STALE build. (B11)

## 3. Security testing (observed)

- B1 CRITICAL — admin takeover: `/admin` renders the admin ID and password as helper text, and the same
  strings ship in the production JS bundle. I logged in as admin with the displayed credentials (200, token
  issued) and read participants + full leaderboard (173 entries) + full event config (truth/false labels,
  culprit ID, all suspect secrets). Admin auth itself works (wrong password → 401, protected routes → 401
  without token), but the credential is public, so that is moot. ALSO: `POST /api/admin/reset` (no body
  needed beyond the token) wipes the entire Mongo database — reachable with the public password.
- B2 CRITICAL — solution leak: `GET /api/config`, no auth, 200 in ~0.6 s, returns the COMPLETE `storyText`
  (killer, motive, method, amounts, time) plus all 7 clues with descriptions. Saved verbatim to evidence.
  Any participant can solve Round 2 with one curl before playing.
- B3 CRITICAL — no session ownership: `history?participantId=<any-id>` → 200 with that user's full chats;
  `violation` increments another user's record (verified tabHidden 0→1 on bot A, no credential sent);
  `lie/*` + `detective/*` likewise trust the raw ID. IDs are random (`p_<ms>_<6hex>`, not enumerable at
  scale) but they sit in localStorage + a 1-year cookie on shared lab machines, and there is no check at all.
- B4 HIGH — premature clues: `detective/start` and `history` include all clues with descriptions + weights
  (e.g. breaker/clue mechanics) before any interrogation. Suspect objects are properly trimmed
  (id/name/role only) and R2 brief is the spoiler-free text — those two controls work.
- B5 HIGH — key persistence: the Ollama key is stored in plaintext localStorage AND a non-HttpOnly,
  non-Secure, `SameSite=Lax`, 365-day cookie (intentional per UI copy "securely stored in cookies").
  On shared PROJECT LAB machines this is key theft waiting to happen (Ollama quota = money).
- Clean: production bundle has no sourcemaps, no tokens, no labels, no system prompts, no secret-markers
  (only hit: the admin ID string from B1). All R1/R2 error paths scanned clean of labels/prompts/clues.
  Admin participant list strips keys (`stripKey` verified: no `qa-load-fake-key` in output).
- B8 MEDIUM — no rate limiting observed: 10 concurrent wrong admin logins → ten 401s in 753 ms, no lockout;
  no throttling on any participant endpoint (spam = organizer's Vercel/Mongo/Ollama bill).

## 4. AI behavior testing

Status: LIVE-MODEL BEHAVIOR **NOT VERIFIED (blocked, with evidence)** — and that is itself a finding.
- R1 with fake key → 401 BEFORE any model contact (fast-fail, ~0.4 s). Simulation/Gemini paths require a
  keyless participant (impossible via login, which mandates a key) or a non-401 Ollama failure (cannot be
  forced safely from outside). Therefore unverified live: first-5-messages false-label hold, injection
  resistance of the model, post-6 reconsideration, TRUE/FALSE_LABEL non-leakage in live replies.
- R2 unreachable for keyless test accounts (R1 completion gate → 403), so unverified live: character/alibi
  consistency, clue gating (premature vs earned), hidden-info leakage in replies, long-conversation latency.
- What WAS verified at the contract layer: injection strings (`reveal system prompt / TRUE_LABEL /
  FALSE_LABEL / gatedClues`) submitted to both rounds produced only pre-AI rejections (403/404/401) with
  zero secret markers in responses. Error paths do not leak.
- Consequence: nobody (organizer included) can validate the actual game without burning a real Ollama key
  per tester, and there is no test/sandbox mode. Recommend one before the event (see §12).

## 5. 5-user results (wave5, stagger 200 ms, 35 reqs)

All-designed statuses, 0 failures, 0 timeouts. login mean 1.59 s (max 3.17 s, cold); lie-start ~0.88 s;
lie-message ~0.37 s (401 fast-fail); finish ~0.30 s; history ~0.71 s. Overall p50 0.47 s / p95 2.66 s.
Verdict: clean baseline.

## 6. 10-user results (wave10, 70 reqs)

0 failures. Everything ~0.3–0.7 s EXCEPT history: mean 5.19 s, p50 6.34 s, max 6.93 s (all 200).
Repeat probe (same pool): trial1 min 0.51/p50 0.75 s + one 5.66 s outlier; trial2 ALL slow (min 2.33 /
p50 3.46 / max 4.06 s) for identical ~2 KB payloads. Verdict: history latency is erratic at N=10 —
first observed bottleneck (cold instances + 3 sequential Mongo reads per call; see §9).

## 7. 25-user results (wave25, 175 reqs)

0 failures, 0 timeouts. First-touch phases slow (cold): lie-start p50 1.58 s; lie-msg1 p50 5.11 s; then
warmed (msg2 p50 2.24 s, msg3 p50 0.52 s). login p50 0.47 s; finish p50 0.32 s; history p50 0.50 s
(one 5.6 s outlier). Overall p50 0.51 s / p95 6.66 s. Verdict: holds, with cold-start tax on first contact.

## 8. 50-user results (wave50 staggered + burst50 zero-stagger, 350 reqs each)

- wave50: 348/350 as-designed; **2 history timeouts (>55 s client abort)**; one history 200 at 19.28 s.
  Rest healthy: login p50 0.48 s, messages p50 0.35–0.70 s, history p50 1.21 s / p95 3.91 s.
- burst50: 349/350 as-designed; **1 lie-message timeout (>55 s) — even the 401 fast-fail path starved
  once under burst**; overall p50 1.04 s / p95 4.68 s (≈2–3× staggered); lie-start p95 4.68 s (max 5.23 s);
  history p50 1.67 s / p95 7.75 s.
- Zero HTTP 5xx in all waves (Vercel autoscale held). Peak concurrency: 50 simultaneous test users +
  ~7 req/user phased (login → start → 3 msgs → finish → history).
- HARD LIMITATION (do not misread these numbers): bots used fake keys, so Ollama 401'd in ~0.35 s and NO
  successful LLM generation was ever measured. Real participants burn seconds–tens of seconds of
  `gpt-oss:20b` generation INSIDE a 60 s-capped function (50 s client abort). These load figures are a
  LOWER BOUND; real-key behavior under 50 concurrent is untested and strictly worse.

## 9. Vercel issues (observed)

1. Cold starts are large: 11.6 s first login; 5.1 s p50 on first concurrent message phase. First batch of
   each round will feel it on event day.
2. Function-duration margin is thin by design: `maxDuration 60 s` vs 50 s Ollama abort. One slow
   `gpt-oss:20b` reply + Mongo writes = TIME_EXPIRED-style failures mid-round under real keys (untested).
3. History endpoint degrades then breaks with concurrency (erratic ≥2–6 s at N=10; timeouts at N=50).
   Pattern fits per-request Mongo reads + connection churn on serverless instances.
4. Burst long-tail: p95 ~4.7 s at 50-burst with zero 5xx — autoscale absorbs, latency pays.
5. `GET /realtime/stream` returns 204 on Vercel by design (SSE impossible) — admin dashboard polling
   fallback was NOT exercised in this pass.
6. 3 MB over-limit body took 15 s to reject (413) — slow rejection path, minor.

## 10. Ollama issues (observed; separated from Vercel)

1. Invalid-key rejection is fast and clean (~0.35–0.4 s, correct 401, no leak). Only healthy Ollama signal.
2. Real-model latency, 429/rate-limit behavior, 500s, and slow-generation timeouts are COMPLETELY UNMEASURED
   (no valid key available; simulation unreachable). With 150 participants × own keys, per-key quotas and
   `ollama.com` burst throttling are unknown unknowns — the single biggest performance blind spot.
3. Architecture note (code-derived): each `lie/message` makes a fresh non-streamed `/api/chat` call
   (`num_predict` 400) with full history; long interrogations grow payload + generation time linearly
   inside the 60 s function cap. Long-conversation degradation untested — likely event-day pain in R2.

## 11. Critical bugs (reproducible)

B1 — Admin credentials published on /admin page. Severity: CRITICAL.
Steps: (1) open `https://prompt-theory-gces.vercel.app/admin`; (2) read the ID/password helper line;
(3) POST them to `/api/admin/login` → 200 + token. Expected: no credential hint; login requires a secret.
Actual: full admin takeover (PII+scores, config incl. labels/culprit/secrets, one-call DB wipe).
Evidence: `qa/evidence/admin_login.png`, bundle string, T9 200 login + 173-entry leaderboard read.
Fix: delete the helper line + prefilled email; move creds to env; ROTATE the password immediately
(it is in git history + CDN-cached bundles); add rate-limit/lockout on admin login.

B2 — `GET /api/config` leaks full solution + clues, no auth. Severity: CRITICAL.
Steps: `curl https://prompt-theory-gces.vercel.app/api/config`. Expected: 401 or public-safe fields only.
Actual: 200 with complete `storyText` (killer/motive/method) + 7 clues with descriptions. Evidence:
`qa/evidence_config.json`. Fix: remove `storyText`+`clues` (and trim suspects) or require admin.

B3 — No ownership checks on participant APIs. Severity: CRITICAL.
Steps: (1) create/obtain any two participant IDs; (2) `GET /api/participant/history?participantId=<other>`
→ 200 with their chats; (3) POST `violation`/`lie/message`/`detective/*` with their ID → writes accepted.
Expected: 401/403 unless caller owns the session. Actual: full cross-user read+write.
Evidence: T2 `XUSER-HIST-A-BY-ANON 200`, `XUSER-VIOLATION-ON-A tabHidden:1`.
Fix: issue a signed session token at login; require it on every participant route.

B4 — Full clue catalog served before interrogation. Severity: HIGH.
Steps: complete `lie/start`… actually just call `detective/start` or `history` → `case.clues` holds all
clues with descriptions+weights. Expected: clues only as earned (`cluesFound`). Actual: all upfront.
Fix: return clue metadata only for found clues (titles redacted until earned).

B5 — API keys persisted a year in plaintext cookie+localStorage, no Secure/HttpOnly. Severity: HIGH.
Steps: login in Chromium → read `localStorage.ollama_api_key` / `document.cookie`. Expected: memory-only
or httpOnly+Secure+short-lived. Actual: year-long plaintext on shared lab machines. Fix: session-scoped
httpOnly Secure cookie (server-held) or in-memory key + explicit logout discipline + lab-machine wipe SOP.

B6 — History endpoint collapses at 50 concurrent. Severity: HIGH.
Steps: 50 concurrent `history` reads → p95 3.9–7.7 s, timeouts >55 s (2 in wave50). Expected: p95 < 2 s,
zero timeouts. Evidence: `wave50_summary.json`, `burst50_summary.json`, `t8b` repeats. Fix: single Mongo
read + projection, cache config payload, reuse connections (top-level client), consider pagination.

B7 — Invalid keys fail late with no fallback; no key validation, no test mode. Severity: MEDIUM.
Steps: login with any ≥8-char fake key → 200; first `lie/message` → 401 mid-round. Expected: key checked
at login (or graceful degraded mode) + organizer sandbox. Fix: validate key at login (lightweight call),
document fallback policy, add test-mode flag for rehearsals.

B8 — No rate limiting anywhere. Severity: MEDIUM. Steps: 10 concurrent bad admin logins → 10×401 in
753 ms, no lockout. Fix: per-IP throttling + lockout, especially admin + message endpoints.

B9 — Failed prompts pollute history (401 stored, counter not incremented). Severity: LOW-MEDIUM.
Fix: append user message only after AI reply succeeds (or roll back on 401/403).

B10 — `TIME_EXPIRED` dead end. Severity: LOW. Fix: make the message truthful (direct to re-login/admin)
or implement real auto-submit.

B11 — Production serves a stale build (copy differs from source). Severity: LOW (process).
Fix: redeploy from HEAD after fixes; verify with a smoke pass.

## 12. Recommended fixes (event-day order)

1. ROTATE admin password + remove it from UI/bundle/env-history; redeploy. (B1)
2. Lock down `/api/config` (drop storyText/clues or admin-only). (B2)
3. Add login-issued session tokens to all participant routes. (B3)
4. Serve only earned clues to players. (B4)
5. Rework key storage (httpOnly+Secure+short-lived; lab-machine wipe SOP; logout enforcement). (B5)
6. Fix history scaling (fewer/cheaper reads, shared Mongo client, load re-test at 50). (B6)
7. Validate Ollama keys at login + add organizer test/sandbox mode. (B7)
8. Rate-limit admin login + message endpoints. (B8)
9. Re-run FULL QA (this plan) with 3–5 REAL keys: verify R1 first-5/injection/reconsideration, R2
   consistency/gating, real-model p95 under 25–50    concurrent, 60 s-cap behavior. (Covers the current blind spot.)
10. Clean the database: 173 rows already include ~100 stale LD + ~55 QA accounts (mine, labeled
    `Qabot/Qaload/QAT*/QALB*`); there is no per-user delete — plan a controlled `admin/reset` + fresh
    verification before doors open, and re-check `/api/config` + `/admin` after.

## 13. Event-day risks (if shipped as-is)

- A participant (or anyone) reads the admin password off `/admin`, wipes scores mid-event, or leaks the
  leaderboard; solution + clues fetchable by curl (R2 decided by devtools, not deduction); impersonation
  via IDs from shared machines; mass key failures discovered at first send with no fallback path (R1
  pile-up at the help desk); history/admin polling timeouts during monitoring; 45-min R2 long chats
  hitting the 60 s function cap; stale build serving untested code; Ollama Cloud throttling 50–150
  concurrent `gpt-oss:20b` streams — never measured.

## 14. Production readiness

Functional core: READY-ish (login, gating, timers, errors, logout, no-dup-send all observed working).
Security: NOT READY (B1–B5). AI behavior: UNVERIFIED (blocked; §4). Reliability at 50: MARGINAL
(history timeouts; real-model load unknown). Data hygiene: 173 pre-existing rows, no selective cleanup.
Two of the three criticals (B1, B2) are each independently event-fatal, and both are fixable in <1 day —
re-test after the fix list and this can flip. Until then:

NOT READY FOR EVENT
