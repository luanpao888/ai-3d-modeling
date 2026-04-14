import { buildMockDsl } from './shared.js';
import type { GenerateDslInput, ProviderAdapter } from './shared.js';

export class MockProviderAdapter implements ProviderAdapter {
  describe() {
    return {
      baseUrl: null
    };
  }

  async generateDsl({ prompt, currentDsl }: GenerateDslInput) {
    return buildMockDsl({ prompt, currentDsl });
  }
}
