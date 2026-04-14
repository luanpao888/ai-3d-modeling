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

export interface ProviderAdapter {
  describe(): { baseUrl: string | null };
  generateDsl(input: GenerateDslInput): Promise<NormalizedDsl>;
}

export const SYSTEM_PROMPT = `You generate JSON only for a local-first 3D modeling DSL.
Rules:
- Units must always be meter.
- Up-axis must always be Y.
- Output structure, not detailed mesh geometry.
- Use assetId references for reusable models.
- Prefer modular primitives and normalized assets.
- Return valid JSON matching the DSL schema.`;

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
