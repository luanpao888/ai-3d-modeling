export async function registerProjectRoutes(app) {
  app.get('/', async () => ({
    items: await app.services.projectService.listProjects()
  }));

  app.post('/', async (request, reply) => {
    const { name, description = '' } = request.body ?? {};
    const project = await app.services.projectService.createProject({ name, description });
    return reply.code(201).send(project);
  });

  app.get('/:projectId', async (request) => {
    return app.services.projectService.getProject(request.params.projectId);
  });

  app.get('/:projectId/versions', async (request) => ({
    items: await app.services.projectService.listDslVersions(request.params.projectId)
  }));

  app.get('/:projectId/versions/:versionId', async (request) => {
    return app.services.projectService.getDslVersion(
      request.params.projectId,
      request.params.versionId
    );
  });

  app.put('/:projectId/dsl', async (request) => {
    return app.services.projectService.saveDsl(request.params.projectId, request.body ?? {}, {
      source: 'replace'
    });
  });

  app.patch('/:projectId/dsl', async (request) => {
    const operations = request.body?.operations ?? [];
    return app.services.projectService.patchDsl(request.params.projectId, operations);
  });
}
