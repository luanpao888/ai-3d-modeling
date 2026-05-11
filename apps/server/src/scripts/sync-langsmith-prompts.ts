import { promises as fs } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { Client } from 'langsmith';

const currentDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const repoRoot = resolve(currentDir, '../../../../');
const promptsDir = resolve(currentDir, '../../prompts');

// Load env from cwd first, then repo root as fallback.
dotenv.config();
dotenv.config({ path: resolve(repoRoot, '.env') });

const apiKey = (process.env.LANGSMITH_API_KEY ?? process.env.LANGCHAIN_API_KEY ?? '').trim();

if (!apiKey) {
  throw new Error('LANGSMITH_API_KEY is required.');
}

const client = new Client({
  apiKey,
  apiUrl: process.env.LANGSMITH_ENDPOINT || process.env.LANGCHAIN_ENDPOINT
});

async function main() {
  const files = await fs.readdir(promptsDir, { withFileTypes: true });
  const promptFiles = files
    .filter((entry) => entry.isFile() && extname(entry.name) === '.txt')
    .map((entry) => entry.name)
    .sort();

  if (promptFiles.length === 0) {
    console.log('No prompt files found.');
    return;
  }

  const results: Array<{ key: string; url: string }> = [];

  for (const fileName of promptFiles) {
    const key = basename(fileName, '.txt');
    const content = (await fs.readFile(resolve(promptsDir, fileName), 'utf-8')).trim();

    if (!content) {
      console.warn(`Skip empty prompt: ${fileName}`);
      continue;
    }

    // LangSmith accepts a prompt manifest object. A messages tuple array keeps this
    // simple and compatible with chat-style prompt editing in the UI.
    const manifest = {
      lc: 1,
      type: 'constructor',
      id: ['langchain', 'prompts', 'prompt', 'PromptTemplate'],
      kwargs: {
        input_variables: [],
        template: content,
        template_format: 'f-string'
      }
    };

    const url = await client.pushPrompt(key, {
      object: manifest,
      description: `Synced from apps/server/prompts/${fileName}`,
      tags: ['ai-3d-modeling', 'server'],
      commitDescription: `sync prompt file ${fileName}`
    });

    results.push({ key, url });
    console.log(`Synced ${key} -> ${url}`);
  }

  console.log(`Done. Synced ${results.length} prompt(s).`);
}

await main();
