export async function registerExportRoutes(app) {
  app.get('/:projectId/zip', async (request, reply) => {
    const { projectId } = request.params;
    const zipBuffer = await app.services.exportService.exportProjectAsZip(projectId);

    reply.header('content-type', 'application/zip');
    reply.header('content-disposition', `attachment; filename="${projectId}.zip"`);
    return reply.send(zipBuffer);
  });

  app.get('/:projectId/glb', async (request, reply) => {
    return reply.code(501).send({
      message: 'GLB export is handled in the Three.js frontend using GLTFExporter.',
      projectId: request.params.projectId
    });
  });
}
