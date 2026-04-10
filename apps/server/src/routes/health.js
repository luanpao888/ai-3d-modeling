export async function registerHealthRoutes(app) {
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ai: app.services.aiProviderService.describe()
  }));
}
