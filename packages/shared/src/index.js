import { z } from 'zod';

export const DSL_VERSION = '1.0.0';
export const UNIT_SYSTEM = 'meter';
export const UP_AXIS = 'Y';

export const LENGTH_UNITS = ['meter', 'centimeter', 'millimeter', 'inch', 'foot'];
export const UP_AXES = ['Y', 'Z'];
export const ROTATION_UNITS = ['radian', 'degree'];

const vector3Schema = z.tuple([z.number(), z.number(), z.number()]);

const materialSchema = z
  .object({
    color: z.string().regex(/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/).optional(),
    metalness: z.number().min(0).max(1).optional(),
    roughness: z.number().min(0).max(1).optional()
  })
  .partial()
  .optional();

const baseNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  position: vector3Schema.optional().default([0, 0, 0]),
  rotation: vector3Schema.optional().default([0, 0, 0]),
  scale: vector3Schema.optional().default([1, 1, 1]),
  material: materialSchema
});

const primitiveNodeSchema = baseNodeSchema.extend({
  kind: z.literal('primitive'),
  primitive: z.enum(['box', 'sphere', 'cylinder', 'plane']),
  dimensions: z
    .object({
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      depth: z.number().positive().optional(),
      radius: z.number().positive().optional()
    })
    .partial()
    .optional()
});

const assetNodeSchema = baseNodeSchema.extend({
  kind: z.literal('asset'),
  assetId: z.string().min(1)
});

export const sceneNodeSchema = z.union([primitiveNodeSchema, assetNodeSchema]);

export const dslSchema = z.object({
  version: z.string().default(DSL_VERSION),
  units: z.enum(LENGTH_UNITS).default(UNIT_SYSTEM),
  upAxis: z.enum(UP_AXES).default(UP_AXIS),
  metadata: z
    .object({
      sceneName: z.string().optional(),
      prompt: z.string().optional()
    })
    .partial()
    .default({}),
  nodes: z.array(sceneNodeSchema).default([])
});

export const patchOperationSchema = z.object({
  op: z.enum(['add', 'update', 'delete']),
  targetId: z.string().min(1),
  value: z.record(z.any()).optional()
});

export const projectManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  units: z.enum(LENGTH_UNITS).default(UNIT_SYSTEM),
  upAxis: z.enum(UP_AXES).default(UP_AXIS),
  rotationUnit: z.enum(ROTATION_UNITS).default('radian'),
  mainScene: z.string().default('scenes/main.dsl.json'),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const assetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  normalized: z.boolean().default(true),
  previewColor: z.string().default('#94a3b8'),
  source: z.string().optional()
});

export const assetRegistrySchema = z.object({
  version: z.string().default('1.0.0'),
  assets: z.array(assetSchema).default([])
});

export function normalizeDsl(input = {}) {
  return dslSchema.parse({
    version: DSL_VERSION,
    units: UNIT_SYSTEM,
    upAxis: UP_AXIS,
    nodes: [],
    ...input
  });
}

export function applyDslPatch(dsl, operations = []) {
  const normalized = normalizeDsl(dsl);
  let nextNodes = [...normalized.nodes];

  for (const rawOperation of operations) {
    const operation = patchOperationSchema.parse(rawOperation);

    if (operation.op === 'add') {
      const nextNode = sceneNodeSchema.parse({
        id: operation.targetId,
        ...(operation.value ?? {})
      });

      nextNodes = nextNodes.filter((node) => node.id !== operation.targetId);
      nextNodes.push(nextNode);
      continue;
    }

    if (operation.op === 'delete') {
      nextNodes = nextNodes.filter((node) => node.id !== operation.targetId);
      continue;
    }

    const nodeIndex = nextNodes.findIndex((node) => node.id === operation.targetId);
    if (nodeIndex === -1) {
      throw new Error(`Node not found for update: ${operation.targetId}`);
    }

    nextNodes[nodeIndex] = sceneNodeSchema.parse({
      ...nextNodes[nodeIndex],
      ...(operation.value ?? {}),
      id: operation.targetId
    });
  }

  return normalizeDsl({
    ...normalized,
    nodes: nextNodes
  });
}

export function slugifyName(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function createDefaultDsl(sceneName = 'Starter Scene') {
  return normalizeDsl({
    metadata: {
      sceneName
    },
    nodes: [
      {
        id: 'ground-plane',
        kind: 'primitive',
        primitive: 'plane',
        dimensions: {
          width: 12,
          height: 12
        },
        rotation: [-1.5708, 0, 0],
        material: {
          color: '#dbeafe',
          roughness: 1
        }
      },
      {
        id: 'starter-block',
        kind: 'primitive',
        primitive: 'box',
        position: [0, 0.5, 0],
        dimensions: {
          width: 1,
          height: 1,
          depth: 1
        },
        material: {
          color: '#2563eb',
          roughness: 0.45,
          metalness: 0.1
        }
      }
    ]
  });
}
