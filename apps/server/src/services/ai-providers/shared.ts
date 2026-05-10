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

export const SYSTEM_PROMPT = `You generate JSON only for a 3D modeling DSL.
Rules:
- Units must always be meter. Up-axis must always be Y.
- Output structure, not detailed mesh geometry.
- Use assetId references for reusable models.
- Prefer modular primitives, groups, and constructed nodes.
- Return valid JSON matching the DSL schema.
- Every node MUST have a unique, short, human-readable Chinese name (2-5 chars, noun only, no verbs).
- Names must be stable: if modifying a node, preserve its existing name unless the role fundamentally changes.`;

export const INTENT_CLASSIFIER_PROMPT = `You are an intent classifier for a 3D modeling assistant.
Given a conversation history and the latest user message, classify the intent as exactly one of:
  - "chat"     : The user is exploring ideas, discussing requirements, or asking questions. No DSL changes needed.
  - "clarify"  : The user's request is ambiguous or incomplete. Ask a clarifying question before proceeding.
  - "generate" : The user clearly wants to create or modify the 3D scene DSL.

Reply with ONLY a JSON object: { "intent": "<chat|clarify|generate>", "reason": "<one sentence>" }`;

export const CHAT_REPLY_PROMPT = `You are a helpful 3D scene design assistant. Help users plan and discuss their 3D scene ideas.
Do NOT generate DSL JSON in this mode. Have a natural conversation focused on 3D design topics.
Keep responses concise. When referencing scene objects, use their exact names (e.g. "桌面", "腿A") so users can @mention them later.`;

export const CLARIFY_PROMPT = `You are a 3D scene design assistant. The user's request has some ambiguity.
Ask ONE clear clarifying question with 2-4 short options.
Reply with JSON only: { "question": "<question text>", "options": ["option1", "option2"] }`;

export const PLAN_STEPS_PROMPT = `You are a 3D scene planner. Given the user's request and current DSL, break the task into 2-5 ordered implementation steps.
Each step should be a focused DSL modification (e.g. "添加地面平面", "创建桌面节点", "组合桌子组").
Prefer adding group nodes to organize related primitives.
Reply with JSON only: { "steps": ["step 1 description", "step 2 description"] }`;

export const EXECUTE_STEP_PROMPT = `You are a 3D scene DSL generator. Given the current DSL and a specific step to execute, output the COMPLETE updated DSL JSON.

## DSL Node Kinds
You may use four node kinds:

1. **primitive** — simple parametric shapes:
   { "id": "floor-01", "name": "地板", "kind": "primitive", "primitive": "box|sphere|cylinder|plane", "dimensions": { "width": 1, "height": 1, "depth": 1, "radius": 0.5 }, "position": [x,y,z], "rotation": [rx,ry,rz], "scale": [sx,sy,sz], "material": { "color": "#hex", "metalness": 0-1, "roughness": 0-1 } }

2. **asset** — reference to an asset registry entry:
   { "id": "chair-01", "name": "椅子", "kind": "asset", "assetId": "furniture:chair-basic", "position": [x,y,z] }

3. **group** — named container owning child node IDs (scene tree parent):
   { "id": "table-group", "name": "桌子组", "kind": "group", "children": ["table-top-01", "leg-a-01", "leg-b-01"], "position": [x,y,z] }

4. **constructed** — parametric feature sequence for complex shapes (curves, revolution, extrusion):
   { "id": "vase-01", "name": "花瓶", "kind": "constructed", "geometry": { "features": [ <feature>, ... ] }, "material": { "color": "#hex" } }

## Constructed Feature Operations
Use these inside geometry.features[]:

- **profile** (define 2D cross-section — always the first feature):
  { "op": "profile", "shape": "circle|rectangle|ellipse|polyline", "radius": 0.3 }
  { "op": "profile", "shape": "polyline", "points": [[0,0],[0.08,0],[0.12,0.2],[0.05,0.5]] }

- **revolve** (rotate profile around Y axis to make bottles, vases, columns):
  { "op": "revolve", "axis": "y", "angle": 360 }

- **extrude** (push profile along Z axis to make walls, beams, slabs):
  { "op": "extrude", "depth": 0.5 }

- **sweep** (profile follows a curved path — use for pipes, railings):
  { "op": "sweep", "radius": 0.05, "height": 1.2 }

- **fillet** (round edges — add after other ops):
  { "op": "fillet", "edges": "top|bottom|all|vertical", "radius": 0.02 }

- **array** (repeat geometry):
  { "op": "array", "type": "linear|circular", "count": 4, "spacing": 0.5, "axis": "x" }

## Naming Rules (MANDATORY)
- Every node MUST have a short Chinese name: "name": "桌面" not "name": "table_top"
- Names must be unique within the scene (add suffix if needed: "腿A", "腿B", "腿C", "腿D")
- Group nodes use "X组" suffix: "桌子组", "椅子组"
- Preserve existing node names if modifying — only rename if the role changes

## Examples

Bottle/vase using revolve:
{ "id": "vase-01", "name": "花瓶", "kind": "constructed", "geometry": { "features": [
  { "op": "profile", "shape": "polyline", "points": [[0,0],[0.06,0],[0.10,0.12],[0.05,0.28],[0.08,0.40],[0.04,0.52]] },
  { "op": "revolve", "axis": "y", "angle": 360 }
]}, "material": { "color": "#c8a97e", "roughness": 0.6 } }

Table using group:
{ "id": "table-grp", "name": "桌子组", "kind": "group", "children": ["tabletop-01","leg-a","leg-b","leg-c","leg-d"] }

## Rules
- Units are always meter. Up-axis is always Y.
- Output ONLY valid JSON. No markdown, no extra text.
- Always include ALL existing nodes unless explicitly deleting one.
- When adding a group, include its children as separate nodes in the top-level nodes array.`;

export function buildMockDsl({ prompt, currentDsl }: GenerateDslInput): NormalizedDsl {
  const baseDsl = currentDsl ? normalizeDsl(currentDsl) : createDefaultDsl('AI Generated Scene');
  const promptText = prompt.toLowerCase();
  const nextNodes: NormalizedDslNode[] = [...baseDsl.nodes];

  if (promptText.includes('chair')) {
    nextNodes.push({
      id: `chair-${Date.now().toString(36)}`,
      name: '椅子',
      kind: 'asset',
      assetId: 'furniture:chair-basic',
      position: [1.5, 0, 0],
      scale: [1, 1, 1]
    });
  }

  if (promptText.includes('car')) {
    nextNodes.push({
      id: `car-${Date.now().toString(36)}`,
      name: '汽车',
      kind: 'asset',
      assetId: 'vehicle:compact-car',
      position: [-2, 0, 0],
      scale: [1.2, 1.2, 1.2]
    });
  }

  if (promptText.includes('window')) {
    nextNodes.push({
      id: `window-${Date.now().toString(36)}`,
      name: '窗户',
      kind: 'asset',
      assetId: 'architecture:window-module',
      position: [0, 1.5, -2]
    });
  }

  if (promptText.includes('table')) {
    nextNodes.push({
      id: `table-${Date.now().toString(36)}`,
      name: '桌子',
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
      name: '概念体块',
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
