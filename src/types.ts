export interface Participant {
  id: string;
  name: string;
  registerNo: string;
  college?: string;
  ollamaKey?: string; // participant's own Ollama Cloud API key (server-side only, never sent to clients)
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
  round1Score: number;
  round2Score: number;
  totalScore: number; // final combined score out of 100
  round1Completed: boolean;
  round2Completed: boolean;
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

export interface CaseConfig {
  caseTitle: string;
  victim: string;
  culpritId: string;
  storyText: string; // FULL truth — server/AI eyes only, never sent to participants
  publicBrief: string; // spoiler-free briefing: what happened, when, who was around
  suspects: Suspect[];
  clues: { id: string; title: string; weight: number; description: string }[];
}
