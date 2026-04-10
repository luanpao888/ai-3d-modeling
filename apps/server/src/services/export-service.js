import fs from 'node:fs/promises';
import path from 'node:path';
import { PassThrough } from 'node:stream';

import archiver from 'archiver';

export class ExportService {
  constructor({ projectsRoot }) {
    this.projectsRoot = projectsRoot;
  }

  async exportProjectAsZip(projectId) {
    const projectPath = this.resolveProjectPath(projectId);
    await fs.access(projectPath);

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
      archive.directory(projectPath, projectId);
      archive.finalize();
    });
  }

  resolveProjectPath(projectId) {
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
      throw new Error('Invalid project id');
    }

    return path.join(this.projectsRoot, projectId);
  }
}
