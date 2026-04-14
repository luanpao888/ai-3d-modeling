export async function registerAiRoutes(app) {
  app.get('/providers', async () => app.services.aiProviderService.describe());

  app.post('/generate-dsl', async (request) => {
    const { prompt, currentDsl } = request.body ?? {};
    const dsl = await app.services.aiProviderService.generateDsl({ prompt, currentDsl });

    return {
      provider: app.services.aiProviderService.describe(),
      dsl
    };
  });
}
