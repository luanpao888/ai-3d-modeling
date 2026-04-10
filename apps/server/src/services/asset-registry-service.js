import fs from 'node:fs/promises';
import path from 'node:path';

import { assetRegistrySchema } from '@ai3d/shared';

const DEFAULT_REGISTRY = {
  version: '1.0.0',
  assets: [
    {
      id: 'furniture:chair-basic',
      name: 'Basic Chair',
      description: 'Normalized placeholder dining chair asset.',
      tags: ['chair', 'furniture', 'interior'],
      normalized: true,
      previewColor: '#f97316',
      source: 'local-registry'
    },
    {
      id: 'vehicle:compact-car',
      name: 'Compact Car',
      description: 'Reusable normalized car blockout for scene planning.',
      tags: ['vehicle', 'car', 'transport'],
      normalized: true,
      previewColor: '#10b981',
      source: 'local-registry'
    },
    {
      id: 'architecture:window-module',
      name: 'Window Module',
      description: 'Facade-friendly modular window asset.',
      tags: ['architecture', 'window', 'building'],
      normalized: true,
      previewColor: '#3b82f6',
      source: 'local-registry'
    }
  ]
};

export class AssetRegistryService {
  constructor({ registryPath } = {}) {
    this.registryPath = path.resolve(
      process.cwd(),
      registryPath ?? 'apps/server/data/asset-registry.json'
    );
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.registryPath), { recursive: true });

    try {
      await fs.access(this.registryPath);
    } catch {
      await fs.writeFile(this.registryPath, `${JSON.stringify(DEFAULT_REGISTRY, null, 2)}\n`, 'utf8');
    }
  }

  async loadRegistry() {
    const content = await fs.readFile(this.registryPath, 'utf8');
    return assetRegistrySchema.parse(JSON.parse(content));
  }

  async getAsset(assetId) {
    const registry = await this.loadRegistry();
    return registry.assets.find((asset) => asset.id === assetId) ?? null;
  }

  async search({ q = '', tags = [] } = {}) {
    const registry = await this.loadRegistry();
    const normalizedQuery = q.trim().toLowerCase();
    const requestedTags = tags.map((tag) => tag.toLowerCase());

    return registry.assets.filter((asset) => {
      const matchesText =
        normalizedQuery.length === 0 ||
        asset.id.toLowerCase().includes(normalizedQuery) ||
        asset.name.toLowerCase().includes(normalizedQuery) ||
        asset.description.toLowerCase().includes(normalizedQuery) ||
        asset.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

      const matchesTags =
        requestedTags.length === 0 ||
        requestedTags.every((tag) => asset.tags.map((item) => item.toLowerCase()).includes(tag));

      return matchesText && matchesTags;
    });
  }
}
