import { createDefaultDsl, normalizeDsl } from '@ai3d/shared';

export const SYSTEM_PROMPT = `You generate JSON only for a local-first 3D modeling DSL.
Rules:
- Units must always be meter.
- Up-axis must always be Y.
- Output structure, not detailed mesh geometry.
- Use assetId references for reusable models.
- Prefer modular primitives and normalized assets.
- Return valid JSON matching the DSL schema.`;

export function buildMockDsl({ prompt, currentDsl }) {
  const baseDsl = currentDsl ? normalizeDsl(currentDsl) : createDefaultDsl('AI Generated Scene');
  const promptText = prompt.toLowerCase();
  const nextNodes = [...baseDsl.nodes];

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

export function defaultModelFor(provider) {
  if (provider === 'openai') {
    return 'gpt-4o-mini';
  }

  return 'mock-scene-planner';
}

export function getConfiguredProviders(env) {
  const configuredProviders = ['mock'];

  if (env.OPENAI_API_KEY) {
    configuredProviders.push('openai');
  }

  return configuredProviders;
}

export function normalizeProvider(provider = 'mock') {
  const normalizedProvider = provider.toLowerCase().trim();
  return ['mock', 'openai'].includes(normalizedProvider) ? normalizedProvider : 'mock';
}

export function extractJson(content) {
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

function dedupeById(nodes) {
  return Array.from(new Map(nodes.map((node) => [node.id, node])).values());
}
