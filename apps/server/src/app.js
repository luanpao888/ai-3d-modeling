import Fastify from 'fastify';
import cors from '@fastify/cors';

import { registerAssetRoutes } from './routes/assets.js';
import { registerAiSessionRoutes } from './routes/ai-sessions.js';
import { registerExportRoutes } from './routes/exports.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerProjectRoutes } from './routes/projects.js';
import { AIProviderService } from './services/ai-provider-service.js';
import { AiOrchestratorService } from './services/ai-orchestrator-service.js';
import { AiSessionService } from './services/ai-session-service.js';
import { AiStreamService } from './services/ai-stream-service.js';
import { AssetRegistryService } from './services/asset-registry-service.js';
import { ExportService } from './services/export-service.js';
import { PostgresService } from './services/postgres-service.js';
import { ProjectService } from './services/project-service.js';

export async function buildApp() {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true
  });

  const postgresService = new PostgresService(process.env);
  const projectService = new ProjectService({
    databaseService: postgresService
  });
  const assetRegistryService = new AssetRegistryService({
    registryPath: process.env.ASSET_REGISTRY_PATH
  });
  const aiProviderService = new AIProviderService(process.env);
  const aiSessionService = new AiSessionService({
    databaseService: postgresService
  });
  const aiStreamService = new AiStreamService();
  const aiOrchestratorService = new AiOrchestratorService({
    aiProviderService,
    projectService,
    aiSessionService,
    aiStreamService
  });
  const exportService = new ExportService({
    projectService
  });

  await postgresService.initialize();
  await projectService.initialize();
  await assetRegistryService.initialize();

  app.decorate('services', {
    projectService,
    assetRegistryService,
    aiProviderService,
    aiSessionService,
    aiStreamService,
    aiOrchestratorService,
    exportService,
    postgresService
  });

  app.addHook('onClose', async () => {
    await postgresService.close();
  });

  await app.register(registerHealthRoutes);
  await app.register(registerProjectRoutes, { prefix: '/projects' });
  await app.register(registerAiSessionRoutes, { prefix: '/projects' });
  await app.register(registerAssetRoutes, { prefix: '/assets' });
  await app.register(registerExportRoutes, { prefix: '/exports' });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;

    reply.status(statusCode).send({
      error: error.name ?? 'Error',
      message: error.message ?? 'Unexpected server error'
    });
  });

  return app;
}
