import { normalizeDsl } from '@ai3d/shared';

import { extractJson, SYSTEM_PROMPT } from './shared.js';

export class OpenAIProviderAdapter {
  constructor({ apiKey, baseUrl, model }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl?.trim() || 'https://api.openai.com/v1';
    this.model = model || 'gpt-4o-mini';
    this.client = null;
  }

  describe() {
    return {
      baseUrl: this.baseUrl
    };
  }

  async generateDsl({ prompt, currentDsl }) {
    const client = await this.getClient();
    const completion = await client.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: JSON.stringify({ prompt, currentDsl }, null, 2)
        }
      ]
    });

    const content = completion.choices?.[0]?.message?.content ?? '{}';
    return normalizeDsl(extractJson(content));
  }

  async getClient() {
    if (this.client) {
      return this.client;
    }

    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
    }

    const { default: OpenAI } = await import('openai');
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl
    });

    return this.client;
  }
}
