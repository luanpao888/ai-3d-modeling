import { normalizeDsl } from '@ai3d/shared';

import type { NormalizedDsl } from './ai-providers/shared.js';

type Aabb = {
  min: [number, number, number];
  max: [number, number, number];
};

type NodeLike = {
  id?: string;
  name?: string;
  kind?: string;
  primitive?: string;
  geometry?: Record<string, unknown>;
  transform?: {
    position?: [number, number, number];
  };
  material?: {
    type?: string;
  };
};

interface ProjectServiceLike {
  getDslVersion(projectId: string, versionId: string): Promise<unknown>;
  saveDsl(projectId: string, dslInput: unknown, options?: { source?: string }): Promise<unknown>;
}

export class AgentToolsService {
  private projectService: ProjectServiceLike;

  constructor({ projectService }: { projectService: ProjectServiceLike }) {
    this.projectService = projectService;
  }

  validateStructure(dslInput: unknown) {
    const errors: Array<{ code: string; message: string; nodeId?: string }> = [];
    let normalized: NormalizedDsl;

    try {
      normalized = normalizeDsl(dslInput) as NormalizedDsl;
    } catch {
      return {
        dsl: null,
        errors: [{ code: 'DSL_INVALID', message: 'DSL parse/normalize failed.' }]
      };
    }

    const nodes = asNodeList(normalized);
    const nodeById = new Map<string, NodeLike>();

    for (const node of nodes) {
      const nodeId = String(node.id ?? '');
      if (!nodeId) {
        errors.push({ code: 'NODE_ID_MISSING', message: 'Node id is missing.' });
        continue;
      }
      if (nodeById.has(nodeId)) {
        errors.push({ code: 'NODE_ID_DUPLICATE', message: `Duplicate node id: ${nodeId}`, nodeId });
      }
      nodeById.set(nodeId, node);

      if (!String(node.name ?? '').trim()) {
        errors.push({ code: 'NODE_NAME_MISSING', message: `Node ${nodeId} has empty name.`, nodeId });
      }

      if (node.kind === 'group') {
        const children = Array.isArray((node as any).children) ? (node as any).children : [];
        for (const childId of children) {
          if (!nodeById.has(childId) && !nodes.find((n) => n.id === childId)) {
            errors.push({
              code: 'GROUP_CHILD_NOT_FOUND',
              message: `Group ${nodeId} references missing child ${childId}.`,
              nodeId
            });
          }
        }
      }

      if (node.kind === 'constructed') {
        const features = (node.geometry as any)?.features;
        if (!Array.isArray(features) || features.length === 0) {
          errors.push({
            code: 'CONSTRUCTED_FEATURES_EMPTY',
            message: `Constructed node ${nodeId} has no features.`,
            nodeId
          });
        }
      }
    }

    return { dsl: normalized, errors };
  }

  analyzeGeometry(dslInput: unknown) {
    const dsl = normalizeDsl(dslInput) as NormalizedDsl;
    const nodes = asNodeList(dsl);
    const bounds = new Map<string, Aabb>();
    const kindCounts: Record<string, number> = {};

    for (const node of nodes) {
      const id = String(node.id ?? '');
      if (!id) continue;
      kindCounts[node.kind ?? 'unknown'] = (kindCounts[node.kind ?? 'unknown'] ?? 0) + 1;
      bounds.set(id, estimateNodeBounds(node));
    }

    const overlaps: Array<{ a: string; b: string }> = [];
    const ids = Array.from(bounds.keys());
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const aId = ids[i];
        const bId = ids[j];
        if (intersects(bounds.get(aId)!, bounds.get(bId)!)) {
          overlaps.push({ a: aId, b: bId });
        }
      }
    }

    const worldBounds = mergeBounds(Array.from(bounds.values()));
    return {
      nodeCount: nodes.length,
      kindCounts,
      overlaps,
      worldBounds
    };
  }

  querySummary(dslInput: unknown) {
    const dsl = normalizeDsl(dslInput) as NormalizedDsl;
    const nodes = asNodeList(dsl);
    const kindCounts: Record<string, number> = {};
    const materialCounts: Record<string, number> = {};

    for (const node of nodes) {
      const kind = node.kind ?? 'unknown';
      kindCounts[kind] = (kindCounts[kind] ?? 0) + 1;
      const material = node.material?.type ?? 'standard';
      materialCounts[material] = (materialCounts[material] ?? 0) + 1;
    }

    return {
      nodeCount: nodes.length,
      kindCounts,
      materialCounts,
      units: (dsl as any).units,
      upAxis: (dsl as any).upAxis
    };
  }

  getNodeInfo(dslInput: unknown, nodeId: string) {
    const dsl = normalizeDsl(dslInput) as NormalizedDsl;
    const node = asNodeList(dsl).find((n) => n.id === nodeId);
    if (!node) {
      return null;
    }

    return {
      node,
      bounds: estimateNodeBounds(node)
    };
  }

  async rollback(projectId: string, versionId: string) {
    const versionPayload = (await this.projectService.getDslVersion(projectId, versionId)) as any;
    const versionDsl = versionPayload?.dsl;
    if (!versionDsl) {
      throw new Error(`Rollback failed: version ${versionId} has no dsl`);
    }

    return this.projectService.saveDsl(projectId, versionDsl, {
      source: `rollback:${versionId}`
    });
  }
}

function asNodeList(dsl: NormalizedDsl): NodeLike[] {
  const nodes = (dsl as any)?.nodes;
  return Array.isArray(nodes) ? (nodes as NodeLike[]) : [];
}

function estimateNodeBounds(node: NodeLike): Aabb {
  const [px, py, pz] = node.transform?.position ?? [0, 0, 0];
  const [sx, sy, sz] = estimateNodeSize(node);
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;

  return {
    min: [px - hx, py - hy, pz - hz],
    max: [px + hx, py + hy, pz + hz]
  };
}

function estimateNodeSize(node: NodeLike): [number, number, number] {
  if (node.kind === 'primitive') {
    const g = node.geometry ?? {};
    if (node.primitive === 'sphere') {
      const r = numberOr(g.radius, 0.5);
      return [2 * r, 2 * r, 2 * r];
    }
    if (node.primitive === 'cylinder') {
      return [2 * numberOr(g.radius, 0.5), numberOr(g.height, 1), 2 * numberOr(g.radius, 0.5)];
    }
    return [numberOr(g.width, 1), numberOr(g.height, 1), numberOr(g.depth, 1)];
  }

  if (node.kind === 'constructed') {
    const features = Array.isArray((node.geometry as any)?.features)
      ? ((node.geometry as any).features as Array<Record<string, unknown>>)
      : [];
    let width = 1;
    let height = 1;
    let depth = 1;

    for (const feature of features) {
      const op = String(feature.op ?? '');
      if (op === 'extrude') {
        width = Math.max(width, numberOr(feature.width, 1));
        height = Math.max(height, numberOr(feature.height, 1));
        depth = Math.max(depth, numberOr(feature.depth, 1));
      } else if (op === 'revolve') {
        const r = numberOr(feature.radius, 0.5);
        width = Math.max(width, 2 * r);
        depth = Math.max(depth, 2 * r);
        height = Math.max(height, numberOr(feature.height, 1));
      } else if (op === 'sweep') {
        const r = numberOr(feature.radius, 0.2);
        width = Math.max(width, 2 * r);
        height = Math.max(height, 2 * r);
        depth = Math.max(depth, numberOr(feature.depth, 1));
      }
    }

    return [width, height, depth];
  }

  // Group/asset are treated as generic placeholders for overlap checks.
  return [1, 1, 1];
}

function mergeBounds(boxes: Aabb[]): Aabb | null {
  if (boxes.length === 0) return null;
  let minX = boxes[0].min[0];
  let minY = boxes[0].min[1];
  let minZ = boxes[0].min[2];
  let maxX = boxes[0].max[0];
  let maxY = boxes[0].max[1];
  let maxZ = boxes[0].max[2];

  for (const box of boxes.slice(1)) {
    minX = Math.min(minX, box.min[0]);
    minY = Math.min(minY, box.min[1]);
    minZ = Math.min(minZ, box.min[2]);
    maxX = Math.max(maxX, box.max[0]);
    maxY = Math.max(maxY, box.max[1]);
    maxZ = Math.max(maxZ, box.max[2]);
  }

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ]
  };
}

function intersects(a: Aabb, b: Aabb): boolean {
  return (
    a.min[0] <= b.max[0] &&
    a.max[0] >= b.min[0] &&
    a.min[1] <= b.max[1] &&
    a.max[1] >= b.min[1] &&
    a.min[2] <= b.max[2] &&
    a.max[2] >= b.min[2]
  );
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
