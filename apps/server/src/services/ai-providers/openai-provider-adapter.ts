import { normalizeDsl } from '@ai3d/shared';
import type OpenAI from 'openai';

import { extractJson, SYSTEM_PROMPT } from './shared.js';
import type { GenerateDslInput, NormalizedDsl, ProviderAdapter, StreamChatInput } from './shared.js';

export class OpenAIProviderAdapter implements ProviderAdapter {
  private apiKey?: string;
  private baseUrl: string;
  private model: string;
  private client: OpenAI | null;

  constructor({ apiKey, baseUrl, model }: { apiKey?: string; baseUrl?: string; model?: string }) {
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

  async generateDsl({ prompt, currentDsl }: GenerateDslInput): Promise<NormalizedDsl> {
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

  async streamChat({ messages, onToken }: StreamChatInput): Promise<string> {
    const client = await this.getClient();
    const stream = await client.chat.completions.create({
      model: this.model,
      stream: true,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[]
    });

    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        onToken(delta);
      }
    }
    return full;
  }

  async getClient(): Promise<OpenAI> {
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
