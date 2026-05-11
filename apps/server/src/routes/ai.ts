import { listPromptDefinitions } from '../services/prompt-loader.js';

export async function registerAiRoutes(app) {
  app.get('/providers', async () => app.services.aiProviderService.describe());

  app.get('/prompts', async () => ({
    prompts: listPromptDefinitions().map(({ key, title, description }) => ({
      key,
      title,
      description
    }))
  }));

  app.get('/prompts/:promptKey', async (request, reply) => {
    const promptKey = String(request.params?.promptKey ?? '').trim();
    const prompt = listPromptDefinitions().find((definition) => definition.key === promptKey);

    if (!prompt) {
      return reply.code(404).send({
        error: 'NotFound',
        message: `Unknown prompt key: ${promptKey}`
      });
    }

    return {
      key: promptKey,
      title: prompt.title,
      description: prompt.description,
      content: prompt.defaultValue
    };
  });

  app.post('/generate-dsl', async (request) => {
    const { prompt, currentDsl } = request.body ?? {};
    const dsl = await app.services.aiProviderService.generateDsl({ prompt, currentDsl });

    return {
      provider: app.services.aiProviderService.describe(),
      dsl
    };
  });
}
