import Fastify from 'fastify';
import cors from '@fastify/cors';

import { registerAssetRoutes } from './routes/assets.js';
import { registerAiRoutes } from './routes/ai.js';
import { registerExportRoutes } from './routes/exports.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerProjectRoutes } from './routes/projects.js';
import { AIProviderService } from './services/ai-provider-service.js';
import { AssetRegistryService } from './services/asset-registry-service.js';
import { ExportService } from './services/export-service.js';
import { ProjectService } from './services/project-service.js';

export async function buildApp() {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true
  });

  const projectService = new ProjectService({
    projectsRoot: process.env.PROJECTS_ROOT
  });
  const assetRegistryService = new AssetRegistryService({
    registryPath: process.env.ASSET_REGISTRY_PATH
  });
  const aiProviderService = new AIProviderService(process.env);
  const exportService = new ExportService({
    projectsRoot: projectService.projectsRoot
  });

  await projectService.initialize();
  await assetRegistryService.initialize();

  app.decorate('services', {
    projectService,
    assetRegistryService,
    aiProviderService,
    exportService
  });

  await app.register(registerHealthRoutes);
  await app.register(registerProjectRoutes, { prefix: '/projects' });
  await app.register(registerAssetRoutes, { prefix: '/assets' });
  await app.register(registerAiRoutes, { prefix: '/ai' });
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
