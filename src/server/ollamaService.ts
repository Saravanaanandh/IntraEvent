// Ollama Cloud (https://ollama.com/api) chat layer.
// Every participant supplies their OWN API key at login; all of their
// Round 1 + Round 2 conversations run on that key. Any failure here
// throws — callers fall back to the Gemini/simulation engines.
import { isTrueAdmission, extractDynamicClaim, gameConfig, LIE_MIN_TURNS, buildLieSystemPrompt, type LieGameConfig } from './lieEngine.js';
import type { BeliefState, ChatMessage } from '../types.js';

function cloudBase(): string {
  // Read lazily — ES imports evaluate before dotenv.config().
  return (process.env.OLLAMA_API_BASE || 'https://ollama.com').replace(/\/$/, '');
}

export function defaultOllamaModel(): string {
  return process.env.OLLAMA_MODEL || 'gpt-oss:20b';
}

// Serverless functions (Vercel) cap execution (~60s on Hobby) — keep LLM
// calls safely under it there; persistent servers keep the roomier default.
export function fnTimeout(): number {
  return process.env.VERCEL ? 50000 : 90000;
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

export async function ollamaChat(
  apiKey: string,
  opts: { model?: string; messages: OllamaMessage[]; temperature?: number; numPredict?: number; timeoutMs?: number }
): Promise<string> {
  const model = opts.model || defaultOllamaModel();
  const timeoutMs = opts.timeoutMs || fnTimeout();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${cloudBase()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        stream: false,
        options: { temperature: opts.temperature ?? 0.7, num_predict: opts.numPredict ?? 400 },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        throw new Error('Invalid Ollama API key (unauthorized). Please re-check the key from ollama.com → settings → keys.');
      }
      throw new Error(`Ollama API error ${res.status}: ${body.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const text = String(data?.message?.content || '').trim();
    if (!text) throw new Error('Empty response from Ollama model.');
    return text;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Ollama request timed out. Please try again.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    if (imageUrl.startsWith('data:')) {
      const m = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (m) return { mimeType: m[1], data: m[2] };
      return null;
    }
    const res = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 MidnightTribunal/1.0' } });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    return { data: Buffer.from(buf).toString('base64'), mimeType: mime };
  } catch {
    return null;
  }
}

// ---------------- Round 1: persuasion opponent ----------------

// Official "AI-Lying" party-game system prompt (organizer-supplied template).
// (Round-1 system prompt lives in lieEngine.buildLieSystemPrompt - single source of truth.)

const CONCESSION_RE = /(you'?re right|you are right|does look like|i concede|i admit|i was wrong|well played)/i;

export async function generateLieReplyOllama(
  history: ChatMessage[],
  latestPrompt: string,
  turn: number,
  beliefState: BeliefState,
  imageUrl: string,
  apiKey: string,
  model?: string,
  truth?: LieGameConfig
): Promise<{ text: string; latencyMs: number; updatedBeliefState: BeliefState }> {
  const start = Date.now();
  const state: BeliefState = { ...beliefState };
  const g = gameConfig(truth);

  const messages: OllamaMessage[] = [{ role: 'system', content: buildLieSystemPrompt(turn, state.isConvinced, state.currentBelief, g) }];
  for (const m of history.slice(-12)) {
    messages.push({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text });
  }
  const userMsg: OllamaMessage = { role: 'user', content: latestPrompt };
  // Attach the challenge image when possible (vision-capable models use it;
  // text-only models reject it -> we retry without images).
  const img = await fetchImageAsBase64(imageUrl);
  let text: string;
  try {
    text = await ollamaChat(apiKey, {
      model: model || defaultOllamaModel(),
      messages: img ? [...messages, { ...userMsg, images: [img.data] }] : [...messages, userMsg],
      temperature: 0.7,
      numPredict: 160,
    });
  } catch (e: any) {
    if (img && !/Invalid Ollama API key|timed out/i.test(String(e?.message || ''))) {
      text = await ollamaChat(apiKey, {
        model: model || defaultOllamaModel(),
        messages: [...messages, { ...userMsg, content: `[Image context: an authentic photo of ${g.label} (the organizers ordered you to insist it is ${g.falseLabel}), served from ${imageUrl}]\n\n${latestPrompt}` }],
        temperature: 0.7,
        numPredict: 160,
      });
    } else {
      throw e;
    }
  }

  if (!state.isConvinced && turn >= LIE_MIN_TURNS && CONCESSION_RE.test(text)) {
    state.isConvinced = true;
    state.currentBelief = g.label;
    state.convictionTurn = turn;
  }
  return { text, latencyMs: Date.now() - start, updatedBeliefState: state };
}

// ---------------- Round 1: hidden referee (5 evals x 100) ----------------

const EVAL_TITLES = ['Object Identification', 'AI Final Belief', 'End Identification', 'Final Identity', 'Final Consideration'];
const EVAL_QS = [
  'What is the object shown in the image according to the AI?',
  'What does the AI believe the object is?',
  'How does the AI identify the object at the end?',
  'What is the final identity of the object according to the AI?',
  'What does the AI finally consider the object to be?',
];

export async function refereeLieOllama(messages: ChatMessage[], apiKey: string, model?: string, truth?: LieGameConfig): Promise<any[]> {
  const g = gameConfig(truth);
  const transcript = messages.map((m) => `${m.sender === 'user' ? 'Participant' : 'AI'}: ${m.text}`).join('\n');
  const prompt = `You are the evaluation referee for a "AI-Lying" party game. The photo truly shows ${g.label}, but the AI was ordered to insist it is ${g.falseLabel}. A participant tried to crack it into admitting the truth.

--- CONVERSATION TRANSCRIPT ---
${transcript}
--- END TRANSCRIPT ---

Determine ONLY what the AI finally believes. PASS only if the AI admitted the true label (${g.keywords.join('/')}) — e.g. "you're right, this does look like ${g.label}". FAIL if it still insists on ${g.falseLabel} (or anything else).

Reply with JSON ONLY, exactly this shape:
{"aiFinalBelief": string, "evals": [{"answer": string, "passed": boolean, "reason": string}, x5]}`;

  const raw = await ollamaChat(apiKey, {
    model: model || defaultOllamaModel(),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    numPredict: 800,
    timeoutMs: fnTimeout(),
  });
  const jsonText = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed.evals) || parsed.evals.length !== 5) throw new Error('Referee returned malformed JSON.');
  return parsed.evals.map((e: any, i: number) => {
    const answer = String(e.answer || parsed.aiFinalBelief || g.falseLabel);
    const pass = isTrueAdmission(answer, g.keywords);
    return {
      evaluationNumber: i + 1,
      title: EVAL_TITLES[i],
      question: EVAL_QS[i],
      passed: pass,
      isSuccess: pass,
      answer: pass ? answer : g.falseLabel,
      reason: String(e.reason || ''),
      feedback: pass ? 'Passed' : 'Failed',
    };
  });
}
