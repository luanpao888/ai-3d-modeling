import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildApp } from './app.js';

const currentFileDir = dirname(fileURLToPath(import.meta.url));

// Try cwd .env first, then fallback to repo-root .env when running via workspace scripts.
dotenv.config();
dotenv.config({ path: resolve(currentFileDir, '../../../.env') });

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const app = await buildApp();

try {
  await app.listen({ port, host });
  app.log.info(`AI 3D backend listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
