import { buildMockDsl } from './shared.js';
import type { GenerateDslInput, ProviderAdapter, StreamChatInput } from './shared.js';

export class MockProviderAdapter implements ProviderAdapter {
  describe() {
    return {
      baseUrl: null
    };
  }

  async generateDsl({ prompt, currentDsl }: GenerateDslInput) {
    return buildMockDsl({ prompt, currentDsl });
  }

  async streamChat({ messages, onToken }: StreamChatInput): Promise<string> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const reply = buildMockReply(lastUser);

    // Simulate token streaming with small chunks
    const words = reply.split(' ');
    for (const word of words) {
      const token = `${word} `;
      onToken(token);
      await delay(40);
    }
    return reply;
  }
}

function buildMockReply(userMessage: string): string {
  const text = userMessage.toLowerCase();

  if (text.includes('你好') || text.includes('hello') || text.includes('hi')) {
    return '你好！我是你的 3D 场景设计助手。你想创建什么样的场景？';
  }
  if (text.includes('房间') || text.includes('room')) {
    return '好的，我来帮你设计一个房间。你希望是什么风格？现代简约、北欧风还是工业风？';
  }
  if (text.includes('颜色') || text.includes('color') || text.includes('材质') || text.includes('material')) {
    return '关于颜色和材质，我需要多了解一些。你更倾向于哪种风格？';
  }
  return '明白了！我来为你生成对应的 3D 场景 DSL。';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
