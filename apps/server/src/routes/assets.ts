export async function registerAssetRoutes(app) {
  app.get('/search', async (request) => {
    const q = request.query?.q ?? '';
    const tags = parseTags(request.query?.tags);

    return {
      items: await app.services.assetRegistryService.search({ q, tags })
    };
  });

  app.get('/:assetId', async (request, reply) => {
    const asset = await app.services.assetRegistryService.getAsset(request.params.assetId);

    if (!asset) {
      return reply.code(404).send({
        message: `Asset not found: ${request.params.assetId}`
      });
    }

    return asset;
  });
}

function parseTags(tags) {
  if (!tags) {
    return [];
  }

  if (Array.isArray(tags)) {
    return tags;
  }

  return String(tags)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}
