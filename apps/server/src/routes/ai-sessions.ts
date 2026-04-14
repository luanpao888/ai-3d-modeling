import type { FastifyInstance } from 'fastify';

interface ProjectParams {
  projectId: string;
}

interface SessionParams extends ProjectParams {
  sessionId: string;
}

interface DecisionParams extends SessionParams {
  questionId: string;
}

interface CreateSessionBody {
  mode?: string;
}

interface SendMessageBody {
  message?: string;
}

interface DecisionBody {
  selectedOption?: string;
  rationale?: string;
}

interface HistoryQuery {
  limit?: string;
  offset?: string;
}

export async function registerAiSessionRoutes(app: FastifyInstance) {
  app.post<{ Params: ProjectParams; Body: CreateSessionBody }>('/:projectId/ai/sessions', async (request, reply) => {
    const mode = request.body?.mode ?? 'navigator';
    const session = await app.services.aiSessionService.createOrGetActiveSession(
      request.params.projectId,
      mode
    );

    app.services.aiStreamService.emit(session.id, 'session.started', {
      sessionId: session.id,
      mode: session.mode
    });

    return reply.code(201).send(session);
  });

  app.get<{ Params: SessionParams }>('/:projectId/ai/sessions/:sessionId', async (request) => {
    return app.services.aiSessionService.getSession(
      request.params.projectId,
      request.params.sessionId
    );
  });

  app.get<{ Params: SessionParams; Querystring: HistoryQuery }>('/:projectId/ai/sessions/:sessionId/history', async (request) => {
    const limit = Number.parseInt(request.query?.limit ?? '', 10);
    const offset = Number.parseInt(request.query?.offset ?? '', 10);

    return app.services.aiSessionService.listHistory(
      request.params.projectId,
      request.params.sessionId,
      {
        limit: Number.isFinite(limit) ? limit : undefined,
        offset: Number.isFinite(offset) ? offset : 0
      }
    );
  });

  app.post<{ Params: SessionParams; Body: SendMessageBody }>('/:projectId/ai/sessions/:sessionId/messages', async (request) => {
    const message = request.body?.message ?? '';
    const session = await app.services.aiSessionService.getSession(
      request.params.projectId,
      request.params.sessionId
    );

    return app.services.aiOrchestratorService.runTurn({
      projectId: request.params.projectId,
      sessionId: request.params.sessionId,
      mode: session.mode,
      userMessage: message
    });
  });

  app.post<{ Params: DecisionParams; Body: DecisionBody }>(
    '/:projectId/ai/sessions/:sessionId/questions/:questionId/decision',
    async (request) => {
      const selectedOption = request.body?.selectedOption ?? '';
      const rationale = request.body?.rationale ?? '';

      return app.services.aiOrchestratorService.continueFromDecision({
        projectId: request.params.projectId,
        sessionId: request.params.sessionId,
        questionId: request.params.questionId,
        selectedOption,
        rationale
      });
    }
  );

  app.get<{ Params: SessionParams }>('/:projectId/ai/sessions/:sessionId/events', async (request, reply) => {
    const { projectId, sessionId } = request.params;
    await app.services.aiSessionService.getSession(projectId, sessionId);

    reply.hijack();
    const unsubscribe = app.services.aiStreamService.subscribe(sessionId, reply);

    const interval = setInterval(() => {
      app.services.aiStreamService.heartbeat(sessionId);
    }, 15000);

    request.raw.on('close', () => {
      clearInterval(interval);
      unsubscribe();
      if (!reply.raw.writableEnded) {
        reply.raw.end();
      }
    });
  });
}