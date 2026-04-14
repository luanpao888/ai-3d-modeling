import { MockProviderAdapter } from './mock-provider-adapter.js';
import { OpenAIProviderAdapter } from './openai-provider-adapter.js';
import type { AIProvider, ProviderAdapter, ProviderEnv } from './shared.js';

export { defaultModelFor, getConfiguredProviders, normalizeProvider } from './shared.js';

export function createProviderAdapter({
  provider,
  model,
  env
}: {
  provider: AIProvider;
  model: string;
  env: ProviderEnv;
}): ProviderAdapter {
  switch (provider) {
    case 'openai':
      return new OpenAIProviderAdapter({
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL,
        model
      });
    case 'mock':
    default:
      return new MockProviderAdapter();
  }
}
