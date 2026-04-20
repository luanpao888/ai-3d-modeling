import {
  createProviderAdapter,
  defaultModelFor,
  getConfiguredProviders,
  normalizeProvider
} from './ai-providers/index.js';
import type {
  AIProvider,
  GenerateDslInput,
  NormalizedDsl,
  ProviderAdapter,
  ProviderEnv,
  StreamChatInput
} from './ai-providers/shared.js';

interface ProviderDescription {
  activeProvider: AIProvider;
  configuredProviders: AIProvider[];
  model: string;
  baseUrl: string | null;
}

export class AIProviderService {
  private env: ProviderEnv;
  private provider: AIProvider;
  private model: string;
  private configuredProviders: AIProvider[];
  private adapter: ProviderAdapter;

  constructor(env: ProviderEnv = {}) {
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

  describe(): ProviderDescription {
    return {
      activeProvider: this.provider,
      configuredProviders: this.configuredProviders,
      model: this.model,
      ...this.adapter.describe()
    };
  }

  async generateDsl({ prompt, currentDsl }: { prompt?: string; currentDsl?: unknown }): Promise<NormalizedDsl> {
    if (!prompt?.trim()) {
      throw new Error('Prompt is required');
    }

    const input: GenerateDslInput = { prompt, currentDsl };
    return this.adapter.generateDsl(input);
  }

  async streamChat(input: StreamChatInput): Promise<string> {
    return this.adapter.streamChat(input);
  }
}
