// Shared Ollama key pool (organizer-provided, event use).
// Participants NEVER see or submit keys: login is name + register no + year,
// and the server assigns each participant a stable pool slot (round-robin).
// These strings must never leave the server (no API may return them).
const RAW_POOL = [
  "5b6acac3f5ee454db02301186eaf03b6.cTuXJ-SwVzUEdpBwX_NNqBHX",
  "8090a9cad2f84050bc1580786eacd571.x0M6blktaQockJbgtWGhuneo",
  "335ef51b25c54d4dae4a87e8275dcf43.UjZtvcymM541thFDNHWXbh_8",
  "6bc594b0789649d9a51743ce8ae2949a.r6gZtnnurcwWxmc6nSxvLyFY",
  "8130addb607c48dfb238d314be3228d2.8P2fP8EevfAw6-mSvEt4rL34",
  "8f0b4eb680a9453fa129a01324394a1e.bIdHk6nMEsN0QeCK2lKCU8Xp",
  "8fccd80c050d45d78fcab9956f80af9f.R9DmGpPKlyFmGJewIaCK71iT",
  "f334b255f0124ec0aac3e54045350a07.ykDLbUNWQyHaQ-0U9wxSmAle",
  "b68c7b0e99be4ed2ac01cd242cde49a2.S-FEGRpUk6bkqDyUT_n16ZvX",
  "8ea4506b57f04d2582e987227facf67e.lxLgFUg6jRP9Hzn4nR8qTyC4",
  "02d49ae380c84082944bc73b80025d96.W7jJuXR-0STxkA9GhqgncoUH",
  "8ecaa97d6c3f4fa4895ea6b13a6fb272.ZCbs6-Y51IFmbht7luqJ77NL",
  "7f1c2a64ce9045d19c1704dc4eb03911.m0dO6pJDTEDws1YZo05z1kCh",
  "066ca102234f4cebae599aa5109f563f.6fYVfALGuJf2fel_PLQ1euwF",
  "bfc434edb0554af38e53e146778c12ce.Fn-_gG1UA_RLUduU-7g8B2b_",
  "cde7a5f90ab541b0954fd0e9f79e3b64.0-p553cpe_TDDfxOai2tzQ6o",
  "26a333bca07d453db0f68b9c87163e73.G9cfEOY3DHytfXq12xQh-5iT",
  "246db6877a144a2eba02a1e20b14309b.oZfgAejK4I94TnXXLQE-uThL",
  "97aac9ff4b434d41a832daf5c8cff4b1.MCdy9ZICkcOFfJKnKVw_0aBt",
  "bcd9cce2701e45f080d83e6e58a546eb.ySVlbS8rAR9VdgS0PE9P2L4G",
  "26a333bca07d453db0f68b9c87163e73.G9cfEOY3DHytfXq12xQh-5iT",
  "246db6877a144a2eba02a1e20b14309b.oZfgAejK4I94TnXXLQE-uThL",
  "d2582400cb104925ac6c4fe3d513cdc9.RudcV8wCfcW__ThV2pr4KV2l",
  "995face9487c489db5bf343c9bb7e815.p3KqMTnU4VEUL1PtNr9Rk4cS",
  "bb494e74f759425c93595146bbbc76be.BslF3wQ8ht4qc-yVeg-Nk4z4",
  "dafddef4f8424245883eede5a04abab5.RwtPs-C1S4br3bMD4E5m9bm7",
  "295b1494147144faac7a54ca2233fba6.WZf8raBr-Affz0lrxB-DvWQT",
  "cd1196ba5cb848498884fa05709c6029.8dIF_ff2fQDW_mZZpyC6w74h",
  "6d6fe17b21b545299396a1684ed7dd7e.O8sCgFfpJ_-l6MMVCY_zUrTX",
  "4b8115ab0c4545f490a66054d783c536.BnO9kIj38jefthoLPoww3u63",
  "b1d7bbc108074a4a96bb4c7c7694cec6.9ZYcp7J5S4Cd_5ohEZjJNphT",
  "0bd02f2c538c4f8bb4c60c43bcead2db.QF3iB--1cjfSmhu-cGJpHdLa",
  "8090a9cad2f84050bc1580786eacd571.x0M6blktaQockJbgtWGhuneo",
  "5b6acac3f5ee454db02301186eaf03b6.cTuXJ-SwVzUEdpBwX_NNqBHX",
  "f25f1d02037547caa570ca7a5c12e118.FQHI21kmBOTf_-hKUSMzhi6E",
  "936c67c89a414058a41981df9638d19d.EFJ3lf1HqsJOeex_dWl45ocm",
  "c67cb9bca28d425e8376a148034abb40.k1IJY96SEy7zz0V69ndbJZ1f",
];

// De-duplicated (the submitted list repeats 4 keys) — order preserved.
export const OLLAMA_KEY_POOL: string[] = Array.from(new Set(RAW_POOL.map((k) => k.trim()).filter(Boolean)));

export const KEY_POOL_SIZE = OLLAMA_KEY_POOL.length;

export function keyForSlot(slot: number): string {
  if (!KEY_POOL_SIZE) throw new Error('Ollama key pool is empty.');
  const i = ((Math.floor(Number(slot) || 0) % KEY_POOL_SIZE) + KEY_POOL_SIZE) % KEY_POOL_SIZE;
  return OLLAMA_KEY_POOL[i];
}
