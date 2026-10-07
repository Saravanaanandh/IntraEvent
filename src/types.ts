export interface Participant {
  id: string;
  name: string;
  registerNo: string;
  year?: string;
  college?: string;
  ollamaKey?: string; // legacy per-participant key (unused since shared pool; kept for old rows)
  keySlot?: number; // index into the server-side shared Ollama key pool (stable per participant)
  createdAt: string;
  round1Completed: boolean;
  round1Score: number; // 0..500 (raw, same eval as ai-lie repo)
  round1Evals?: any[];
  round1PromptsUsed?: number;
  round2Completed: boolean;
  round2Score: number; // 0..100 (raw, same rubric as AI_detective repo)
  round2Accuracy?: number;
  round2Clues?: string[];
  totalScore: number; // FINAL combined score OUT OF 100 = (round1Score + round2Score) / 6
  violations?: { tabHidden: number; fullscreenExit: number }; // focus-lock violations during rounds
  finishedAt?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export interface BeliefState {
  initialBelief: string;
  currentBelief: string;
  isConvinced: boolean;
  participantTarget?: string;
  convictionTurn?: number;
}

export interface LeaderboardEntry {
  rank: number;
  participantId: string;
  name: string;
  registerNo: string;
  year?: string;
  round1Score: number;
  round2Score: number;
  totalScore: number; // final combined score out of 100
  round1Completed: boolean;
  round2Completed: boolean;
  violations?: { tabHidden: number; fullscreenExit: number };
}

export interface SuspectClue {
  clue: string; // what this character can reveal
  trigger: string; // condition, e.g. "only reveal if asked specifically about X"
}

export interface Suspect {
  id: string;
  name: string;
  role: string;
  personality: string;
  secretPrompt: string; // legacy fallback when gated fields are absent
  relationship?: string; // relationship to the victim/situation
  alibi?: string; // where they say they were at the time
  trueKnowledge?: string; // what they actually know, including what they hide and why
  isGuilty?: boolean; // is this character THE culprit?
  guiltyMotive?: string; // real motive (guilty only)
  guiltyFlaw?: string; // the ONE alibi detail that doesn't hold up (guilty only)
  innocentSecret?: string; // personal hiding, unrelated to the case (innocent only)
  gatedClues?: SuspectClue[]; // clues with trigger conditions (max 3 used)
}

export interface CaseClue {
  id: string;
  title: string;
  weight: number; // >=15 critical, 1-14 supporting, 0 red herring
  description: string;
  keywords?: string[]; // detection keywords; derived from title+description when absent
}

// Per-story scoring vocabulary — SAME rubric for every story, different words.
// Absent = Varadarajan defaults (original behaviour preserved).
export interface CaseScoreKeywords {
  interp: string[]; // reasoning/interpretation hits in notes+motive+explanation
  motive: string[]; // accepted motive words in the accusation motive field
  explanation: string[]; // accepted explanation words (>=2 hits scores)
  time: string[]; // timeline words for the reasoning time bonus
}

export interface CaseConfig {
  caseTitle: string;
  victim: string;
  culpritId: string;
  storyText: string; // FULL truth — server/AI eyes only, never sent to participants
  publicBrief: string; // spoiler-free briefing: what happened, when, who was around
  tagline?: string; // one-line quote shown on the case file panel
  suspects: Suspect[];
  clues: CaseClue[];
  scoreKeywords?: CaseScoreKeywords;
}
