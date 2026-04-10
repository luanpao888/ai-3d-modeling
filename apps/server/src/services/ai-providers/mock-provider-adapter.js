import { buildMockDsl } from './shared.js';

export class MockProviderAdapter {
  describe() {
    return {
      baseUrl: null
    };
  }

  async generateDsl({ prompt, currentDsl }) {
    return buildMockDsl({ prompt, currentDsl });
  }
}
