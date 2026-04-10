import fs from 'node:fs/promises';
import path from 'node:path';

import { nanoid } from 'nanoid';

import {
  applyDslPatch,
  createDefaultDsl,
  normalizeDsl,
  projectManifestSchema,
  slugifyName
} from '@ai3d/shared';

export class ProjectService {
  constructor({ projectsRoot } = {}) {
    this.projectsRoot = path.resolve(process.cwd(), projectsRoot ?? 'data/projects');
  }

  async initialize() {
    await fs.mkdir(this.projectsRoot, { recursive: true });
  }

  async listProjects() {
    const entries = await fs.readdir(this.projectsRoot, { withFileTypes: true });
    const projects = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      try {
        const project = await this.getProject(entry.name);
        projects.push({
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        });
      } catch {
        // Ignore malformed project folders so the service remains resilient.
      }
    }

    return projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async createProject({ name, description = '' }) {
    if (!name?.trim()) {
      throw new Error('Project name is required');
    }

    const baseId = slugifyName(name) || 'project';
    const projectId = `${baseId}-${nanoid(6)}`;
    const projectPath = this.resolveProjectPath(projectId);
    const createdAt = new Date().toISOString();

    await fs.mkdir(path.join(projectPath, 'scenes'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'assets'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'exports'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'meta'), { recursive: true });

    const manifest = projectManifestSchema.parse({
      id: projectId,
      name: name.trim(),
      description,
      createdAt,
      updatedAt: createdAt,
      mainScene: 'scenes/main.dsl.json'
    });

    const dsl = createDefaultDsl(`${name.trim()} Scene`);

    await writeJson(path.join(projectPath, 'project.json'), manifest);
    await writeJson(path.join(projectPath, manifest.mainScene), dsl);

    return this.getProject(projectId);
  }

  async getProject(projectId) {
    const projectPath = this.resolveProjectPath(projectId);
    const manifestPath = path.join(projectPath, 'project.json');
    const manifest = projectManifestSchema.parse(await readJson(manifestPath));
    const dsl = normalizeDsl(await readJson(path.join(projectPath, manifest.mainScene)));

    return {
      ...manifest,
      dsl
    };
  }

  async saveDsl(projectId, dslInput) {
    const project = await this.getProject(projectId);
    const projectPath = this.resolveProjectPath(projectId);
    const dsl = normalizeDsl(dslInput);
    const updatedManifest = projectManifestSchema.parse({
      ...project,
      updatedAt: new Date().toISOString()
    });

    await writeJson(path.join(projectPath, project.mainScene), dsl);
    await writeJson(path.join(projectPath, 'project.json'), updatedManifest);

    return this.getProject(projectId);
  }

  async patchDsl(projectId, operations) {
    const project = await this.getProject(projectId);
    const nextDsl = applyDslPatch(project.dsl, operations ?? []);
    return this.saveDsl(projectId, nextDsl);
  }

  resolveProjectPath(projectId) {
    const safeId = this.ensureSafeProjectId(projectId);
    return path.join(this.projectsRoot, safeId);
  }

  ensureSafeProjectId(projectId) {
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
      throw new Error('Invalid project id');
    }

    return projectId;
  }
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
