import {
  createProviderAdapter,
  defaultModelFor,
  getConfiguredProviders,
  normalizeProvider
} from './ai-providers/index.js';

export class AIProviderService {
  constructor(env = {}) {
    this.env = env;
    this.provider = normalizeProvider(env.AI_PROVIDER);
    this.model = env.AI_MODEL || defaultModelFor(this.provider);
    this.configuredProviders = getConfiguredProviders(env);
    this.adapter = createProviderAdapter({
      provider: this.provider,
      model: this.model,
      env
    });
  }

  describe() {
    return {
      activeProvider: this.provider,
      configuredProviders: this.configuredProviders,
      model: this.model,
      ...this.adapter.describe()
    };
  }

  async generateDsl({ prompt, currentDsl }) {
    if (!prompt?.trim()) {
      throw new Error('Prompt is required');
    }

    return this.adapter.generateDsl({ prompt, currentDsl });
  }
}
