import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export type PromptKey =
  | 'dsl_generation'
  | 'intent_classifier'
  | 'chat_reply'
  | 'clarify'
  | 'plan_steps'
  | 'execute_step'
  | 'engineering_management';

interface PromptDefinition {
  key: PromptKey;
  title: string;
  description: string;
  defaultValue: string;
}

const PROMPT_METADATA: Record<PromptKey, Omit<PromptDefinition, 'defaultValue'>> = {
  dsl_generation: {
    key: 'dsl_generation',
    title: 'DSL generation',
    description: 'Primary system prompt used for direct scene DSL generation.'
  },
  intent_classifier: {
    key: 'intent_classifier',
    title: 'Intent classifier',
    description: 'Classifies whether the user wants chat, clarification, or DSL generation.'
  },
  chat_reply: {
    key: 'chat_reply',
    title: 'Chat reply',
    description: 'Natural language response prompt for conversational turns.'
  },
  clarify: {
    key: 'clarify',
    title: 'Clarification prompt',
    description: 'Asks for one clear question when the request is ambiguous.'
  },
  plan_steps: {
    key: 'plan_steps',
    title: 'Planning prompt',
    description: 'Breaks a request into ordered implementation steps.'
  },
  execute_step: {
    key: 'execute_step',
    title: 'Execution prompt',
    description: 'Produces the full updated DSL JSON for one implementation step.'
  },
  engineering_management: {
    key: 'engineering_management',
    title: 'Engineering management',
    description: 'A reusable management prompt for planning engineering work, tracking risks, and producing action items.'
  }
};

// Cache for loaded prompts
let promptCache: Partial<Record<PromptKey, string>> = {};
let isLoaded = false;

const currentDir = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(currentDir, '../../prompts');

export async function loadPrompts(): Promise<void> {
  if (isLoaded) return;

  for (const key of Object.keys(PROMPT_METADATA) as PromptKey[]) {
    try {
      const filePath = join(PROMPTS_DIR, `${key}.txt`);
      const content = await fs.readFile(filePath, 'utf-8');
      promptCache[key] = content;
    } catch (error) {
      console.warn(`Failed to load prompt ${key}:`, error);
      // Silently skip missing files
    }
  }

  isLoaded = true;
}

export function getPromptDefinition(key: PromptKey): PromptDefinition {
  const metadata = PROMPT_METADATA[key];
  const defaultValue = promptCache[key] || '';

  return {
    ...metadata,
    defaultValue
  };
}

export function getPromptText(key: PromptKey): string {
  return getPromptDefinition(key).defaultValue;
}

export function listPromptDefinitions(): PromptDefinition[] {
  return Object.keys(PROMPT_METADATA).map((key) => getPromptDefinition(key as PromptKey));
}
