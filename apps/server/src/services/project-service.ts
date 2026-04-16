import { nanoid } from 'nanoid';

import {
  applyDslPatch,
  createDefaultDsl,
  normalizeDsl,
  projectManifestSchema,
  slugifyName
} from '@ai3d/shared';

export class ProjectService {
  private databaseService: any;

  constructor({ databaseService }: { databaseService?: any } = {}) {
    this.databaseService = databaseService;
  }

  async initialize() {}

  async listProjects() {
    const { rows } = await this.databaseService.query(
      `
        SELECT
          p.id,
          p.name,
          p.description,
          p.units,
          p.up_axis,
          p.main_scene,
          p.created_at,
          p.updated_at,
          p.current_version_id,
          v.version_number AS current_version_number,
          v.created_at AS current_version_created_at
        FROM projects p
        LEFT JOIN project_dsl_versions v ON v.id = p.current_version_id
        ORDER BY p.updated_at DESC
      `
    );

    return rows.map((row) => ({
      ...toProjectManifest(row),
      currentVersion: toVersionSummary(row)
    }));
  }

  async createProject({ name, description = '', units, upAxis, rotationUnit }: { name?: string; description?: string; units?: string; upAxis?: string; rotationUnit?: string }) {
    if (!name?.trim()) {
      throw new Error('Project name is required');
    }

    const normalizedName = name.trim();
    const baseId = slugifyName(normalizedName) || 'project';
    const projectId = `${baseId}-${nanoid(6)}`;
    const dsl = createDefaultDsl(`${normalizedName} Scene`);
    const resolvedUnits = units ?? dsl.units;
    const resolvedUpAxis = upAxis ?? dsl.upAxis;
    const versionId = nanoid(12);

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `
          INSERT INTO projects (id, slug, name, description, units, up_axis, main_scene)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          projectId,
          baseId,
          normalizedName,
          description,
          resolvedUnits,
          resolvedUpAxis,
          'db://dsl/current'
        ]
      );

      await client.query(
        `
          INSERT INTO project_dsl_versions (
            id,
            project_id,
            version_number,
            dsl,
            source,
            prompt,
            parent_version_id
          )
          VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
        `,
        [versionId, projectId, 1, JSON.stringify(dsl), 'seed', dsl.metadata?.prompt ?? null, null]
      );

      await client.query(
        `
          UPDATE projects
          SET current_version_id = $2
          WHERE id = $1
        `,
        [projectId, versionId]
      );
    });

    return this.getProject(projectId);
  }

  async getProject(projectId: string) {
    const row = await this.loadCurrentProjectRow(projectId);

    return {
      ...toProjectManifest(row),
      dsl: normalizeDsl(row.current_dsl ?? {}),
      currentVersion: toVersionDetails(row)
    };
  }

  async saveDsl(projectId: string, dslInput: unknown, options: { source?: string } = {}) {
    const dsl = normalizeDsl(dslInput);

    await this.databaseService.withTransaction(async (client) => {
      const project = await this.lockProjectVersionState(client, projectId);
      const nextVersionNumber = project.current_version_number + 1;
      const versionId = nanoid(12);

      await client.query(
        `
          INSERT INTO project_dsl_versions (
            id,
            project_id,
            version_number,
            dsl,
            source,
            prompt,
            parent_version_id
          )
          VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
        `,
        [
          versionId,
          projectId,
          nextVersionNumber,
          JSON.stringify(dsl),
          options.source ?? 'replace',
          dsl.metadata?.prompt ?? null,
          project.current_version_id
        ]
      );

      await client.query(
        `
          UPDATE projects
          SET
            units = $2,
            up_axis = $3,
            current_version_id = $4,
            updated_at = NOW()
          WHERE id = $1
        `,
        [projectId, dsl.units, dsl.upAxis, versionId]
      );
    });

    return this.getProject(projectId);
  }

  async patchDsl(projectId: string, operations: any[]) {
    await this.databaseService.withTransaction(async (client) => {
      const project = await this.lockProjectVersionState(client, projectId);
      const patchedDsl = applyDslPatch(project.current_dsl, operations ?? []);
      const nextVersionNumber = project.current_version_number + 1;
      const versionId = nanoid(12);

      await client.query(
        `
          INSERT INTO project_dsl_versions (
            id,
            project_id,
            version_number,
            dsl,
            source,
            prompt,
            parent_version_id
          )
          VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
        `,
        [
          versionId,
          projectId,
          nextVersionNumber,
          JSON.stringify(patchedDsl),
          'patch',
          patchedDsl.metadata?.prompt ?? null,
          project.current_version_id
        ]
      );

      await client.query(
        `
          UPDATE projects
          SET
            units = $2,
            up_axis = $3,
            current_version_id = $4,
            updated_at = NOW()
          WHERE id = $1
        `,
        [projectId, patchedDsl.units, patchedDsl.upAxis, versionId]
      );

      return patchedDsl;
    });

    return this.getProject(projectId);
  }

  async listDslVersions(projectId: string) {
    await this.assertProjectExists(projectId);

    const { rows } = await this.databaseService.query(
      `
        SELECT id, version_number, source, prompt, parent_version_id, created_at
        FROM project_dsl_versions
        WHERE project_id = $1
        ORDER BY version_number DESC
      `,
      [projectId]
    );

    return rows.map((row) => ({
      id: row.id,
      versionNumber: row.version_number,
      source: row.source,
      prompt: row.prompt,
      parentVersionId: row.parent_version_id,
      createdAt: toIsoString(row.created_at)
    }));
  }

  async getDslVersion(projectId: string, versionId: string) {
    const { rows } = await this.databaseService.query(
      `
        SELECT
          p.id,
          p.name,
          p.description,
          p.units,
          p.up_axis,
          p.main_scene,
          p.created_at,
          p.updated_at,
          p.current_version_id,
          v.id AS version_id,
          v.version_number,
          v.dsl,
          v.source,
          v.prompt,
          v.parent_version_id,
          v.created_at AS version_created_at
        FROM projects p
        JOIN project_dsl_versions v ON v.project_id = p.id
        WHERE p.id = $1 AND v.id = $2
      `,
      [projectId, versionId]
    );

    const row = rows[0];
    if (!row) {
      throw notFound(`DSL version not found: ${versionId}`);
    }

    return {
      ...toProjectManifest(row),
      dsl: normalizeDsl(row.dsl),
      version: {
        id: row.version_id,
        versionNumber: row.version_number,
        source: row.source,
        prompt: row.prompt,
        parentVersionId: row.parent_version_id,
        createdAt: toIsoString(row.version_created_at),
        isCurrent: row.version_id === row.current_version_id
      }
    };
  }

  async getExportBundle(projectId: string) {
    const project = await this.getProject(projectId);
    const { rows } = await this.databaseService.query(
      `
        SELECT id, version_number, dsl, source, prompt, parent_version_id, created_at
        FROM project_dsl_versions
        WHERE project_id = $1
        ORDER BY version_number ASC
      `,
      [projectId]
    );

    return {
      manifest: {
        id: project.id,
        name: project.name,
        description: project.description,
        units: project.units,
        upAxis: project.upAxis,
        mainScene: project.mainScene,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        currentVersion: project.currentVersion
      },
      currentDsl: project.dsl,
      versions: rows.map((row) => ({
        id: row.id,
        versionNumber: row.version_number,
        source: row.source,
        prompt: row.prompt,
        parentVersionId: row.parent_version_id,
        createdAt: toIsoString(row.created_at),
        dsl: normalizeDsl(row.dsl)
      }))
    };
  }

  async assertProjectExists(projectId: string) {
    const { rowCount } = await this.databaseService.query('SELECT 1 FROM projects WHERE id = $1', [projectId]);
    if (rowCount === 0) {
      throw notFound(`Project not found: ${projectId}`);
    }
  }

  async loadCurrentProjectRow(projectId: string) {
    const { rows } = await this.databaseService.query(
      `
        SELECT
          p.id,
          p.name,
          p.description,
          p.units,
          p.up_axis,
          p.main_scene,
          p.created_at,
          p.updated_at,
          p.current_version_id,
          v.version_number AS current_version_number,
          v.source AS current_version_source,
          v.prompt AS current_version_prompt,
          v.parent_version_id AS current_version_parent_id,
          v.created_at AS current_version_created_at,
          v.dsl AS current_dsl
        FROM projects p
        LEFT JOIN project_dsl_versions v ON v.id = p.current_version_id
        WHERE p.id = $1
      `,
      [projectId]
    );

    const row = rows[0];
    if (!row) {
      throw notFound(`Project not found: ${projectId}`);
    }

    return row;
  }

  async lockProjectVersionState(client: any, projectId: string) {
    const { rows } = await client.query(
      `
        SELECT
          p.id,
          p.current_version_id,
          COALESCE(v.version_number, 0) AS current_version_number,
          COALESCE(v.dsl, $2::jsonb) AS current_dsl
        FROM projects p
        LEFT JOIN project_dsl_versions v ON v.id = p.current_version_id
        WHERE p.id = $1
        FOR UPDATE OF p
      `,
      [projectId, JSON.stringify(createDefaultDsl('Starter Scene'))]
    );

    const row = rows[0];
    if (!row) {
      throw notFound(`Project not found: ${projectId}`);
    }

    return {
      current_version_id: row.current_version_id,
      current_version_number: Number(row.current_version_number ?? 0),
      current_dsl: normalizeDsl(row.current_dsl)
    };
  }
}

function toProjectManifest(row: any) {
  return projectManifestSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    units: row.units,
    upAxis: row.up_axis,
    mainScene: row.main_scene,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  });
}

function toVersionSummary(row: any) {
  if (!row.current_version_id) {
    return null;
  }

  return {
    id: row.current_version_id,
    versionNumber: row.current_version_number,
    createdAt: toIsoString(row.current_version_created_at)
  };
}

function toVersionDetails(row: any) {
  if (!row.current_version_id) {
    return null;
  }

  return {
    id: row.current_version_id,
    versionNumber: row.current_version_number,
    source: row.current_version_source,
    prompt: row.current_version_prompt,
    parentVersionId: row.current_version_parent_id,
    createdAt: toIsoString(row.current_version_created_at)
  };
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function notFound(message) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 404;
  return error;
}
