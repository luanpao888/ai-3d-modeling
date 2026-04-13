import { PassThrough } from 'node:stream';

import archiver from 'archiver';

export class ExportService {
  constructor({ projectService }) {
    this.projectService = projectService;
  }

  async exportProjectAsZip(projectId) {
    const bundle = await this.projectService.getExportBundle(projectId);

    return new Promise((resolve, reject) => {
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });
      const stream = new PassThrough();
      const chunks = [];

      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
      archive.on('error', reject);

      archive.pipe(stream);

      archive.append(`${JSON.stringify(bundle.manifest, null, 2)}\n`, {
        name: `${projectId}/project.json`
      });
      archive.append(`${JSON.stringify(bundle.currentDsl, null, 2)}\n`, {
        name: `${projectId}/scenes/current.dsl.json`
      });
      archive.append(
        `${JSON.stringify(
          bundle.versions.map(({ dsl, ...version }) => version),
          null,
          2
        )}\n`,
        {
          name: `${projectId}/versions/index.json`
        }
      );

      for (const version of bundle.versions) {
        archive.append(`${JSON.stringify(version.dsl, null, 2)}\n`, {
          name: `${projectId}/versions/v${String(version.versionNumber).padStart(4, '0')}-${version.id}.dsl.json`
        });
      }

      archive.finalize();
    });
  }
}
