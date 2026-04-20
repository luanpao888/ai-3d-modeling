import { createDefaultDsl, normalizeDsl } from '@ai3d/shared';

export type AIProvider = 'mock' | 'openai';
export type NormalizedDsl = ReturnType<typeof normalizeDsl>;
type NormalizedDslNode = NormalizedDsl['nodes'][number];

export interface ProviderEnv {
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  [key: string]: string | undefined;
}

export interface GenerateDslInput {
  prompt: string;
  currentDsl?: unknown;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type TokenCallback = (delta: string) => void;

export interface StreamChatInput {
  messages: ChatMessage[];
  onToken: TokenCallback;
}

export interface ProviderAdapter {
  describe(): { baseUrl: string | null };
  generateDsl(input: GenerateDslInput): Promise<NormalizedDsl>;
  streamChat(input: StreamChatInput): Promise<string>;
}

export const SYSTEM_PROMPT = `You generate JSON only for a local-first 3D modeling DSL.
Rules:
- Units must always be meter.
- Up-axis must always be Y.
- Output structure, not detailed mesh geometry.
- Use assetId references for reusable models.
- Prefer modular primitives and normalized assets.
- Return valid JSON matching the DSL schema.`;

export const INTENT_CLASSIFIER_PROMPT = `You are an intent classifier for a 3D modeling assistant.
Given a conversation history and the latest user message, classify the intent as exactly one of:
  - "chat"     : The user is exploring ideas, discussing requirements, or asking questions. No DSL changes needed.
  - "clarify"  : The user's request is ambiguous or incomplete. You should ask a clarifying question before proceeding.
  - "generate" : The user clearly wants to create or modify the 3D scene DSL.

Reply with ONLY a JSON object: { "intent": "<chat|clarify|generate>", "reason": "<one sentence>" }`;

export const CHAT_REPLY_PROMPT = `You are a helpful 3D scene design assistant. You help users plan and discuss their 3D scene ideas.
You do NOT generate DSL JSON in this mode. Just have a natural conversation.
Keep responses concise and focused on 3D design topics.`;

export const CLARIFY_PROMPT = `You are a 3D scene design assistant. The user's request has some ambiguity.
Ask ONE clear clarifying question with 2-4 short options.
Reply with JSON only: { "question": "<question text>", "options": ["option1", "option2"] }`;

export const PLAN_STEPS_PROMPT = `You are a 3D scene planner. Given the user's request and current DSL, break the task into 2-5 ordered implementation steps.
Each step should be a focused DSL modification (e.g. "Add a floor plane", "Place a blue cube at origin").
Reply with JSON only: { "steps": ["step 1 description", "step 2 description"] }`;

export const EXECUTE_STEP_PROMPT = `You are a 3D scene DSL generator. Given the current DSL and a specific step to execute, output the COMPLETE updated DSL JSON.
Rules:
- Units must always be meter. Up-axis must always be Y.
- Output structure, not detailed mesh geometry.
- Return ONLY valid JSON matching the DSL schema, no extra text.`;

export function buildMockDsl({ prompt, currentDsl }: GenerateDslInput): NormalizedDsl {
  const baseDsl = currentDsl ? normalizeDsl(currentDsl) : createDefaultDsl('AI Generated Scene');
  const promptText = prompt.toLowerCase();
  const nextNodes: NormalizedDslNode[] = [...baseDsl.nodes];

  if (promptText.includes('chair')) {
    nextNodes.push({
      id: `chair-${Date.now().toString(36)}`,
      kind: 'asset',
      assetId: 'furniture:chair-basic',
      position: [1.5, 0, 0],
      scale: [1, 1, 1]
    });
  }

  if (promptText.includes('car')) {
    nextNodes.push({
      id: `car-${Date.now().toString(36)}`,
      kind: 'asset',
      assetId: 'vehicle:compact-car',
      position: [-2, 0, 0],
      scale: [1.2, 1.2, 1.2]
    });
  }

  if (promptText.includes('window')) {
    nextNodes.push({
      id: `window-${Date.now().toString(36)}`,
      kind: 'asset',
      assetId: 'architecture:window-module',
      position: [0, 1.5, -2]
    });
  }

  if (promptText.includes('table')) {
    nextNodes.push({
      id: `table-${Date.now().toString(36)}`,
      kind: 'primitive',
      primitive: 'box',
      position: [0, 0.75, 0],
      dimensions: {
        width: 1.6,
        height: 0.1,
        depth: 0.8
      },
      material: {
        color: '#8b5cf6'
      }
    });
  }

  if (nextNodes.length === baseDsl.nodes.length) {
    nextNodes.push({
      id: `concept-${Date.now().toString(36)}`,
      kind: 'primitive',
      primitive: 'box',
      position: [0, 0.5, -1.5],
      dimensions: {
        width: 1,
        height: 1,
        depth: 1
      },
      material: {
        color: '#06b6d4'
      }
    });
  }

  return normalizeDsl({
    ...baseDsl,
    metadata: {
      ...baseDsl.metadata,
      prompt
    },
    nodes: dedupeById(nextNodes)
  });
}

export function defaultModelFor(provider: AIProvider): string {
  if (provider === 'openai') {
    return 'gpt-4o-mini';
  }

  return 'mock-scene-planner';
}

export function getConfiguredProviders(env: ProviderEnv): AIProvider[] {
  const configuredProviders: AIProvider[] = ['mock'];

  if (env.OPENAI_API_KEY) {
    configuredProviders.push('openai');
  }

  return configuredProviders;
}

export function normalizeProvider(provider = 'mock'): AIProvider {
  const normalizedProvider = provider.toLowerCase().trim();
  return normalizedProvider === 'mock' || normalizedProvider === 'openai'
    ? normalizedProvider
    : 'mock';
}

export function extractJson(content: string): unknown {
  const trimmed = content.trim();

  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('AI provider did not return valid JSON');
  }

  return JSON.parse(match[0]);
}

function dedupeById(nodes: NormalizedDslNode[]): NormalizedDslNode[] {
  return Array.from(new Map(nodes.map((node) => [node.id, node])).values());
}
