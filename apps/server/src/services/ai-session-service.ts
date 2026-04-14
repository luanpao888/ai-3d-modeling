import { nanoid } from 'nanoid';
import type {
  DecisionRecord,
  MessageRecord,
  QuestionRecord,
  SessionHistoryRecord,
  SessionRecord
} from '@ai3d/shared/types';
interface QueryResultLike<TRow> {
  rows: TRow[];
  rowCount: number;
}

interface QueryClient {
  query<TRow>(sql: string, params?: unknown[]): Promise<QueryResultLike<TRow>>;
}

interface DatabaseService {
  query<TRow>(sql: string, params?: unknown[]): Promise<QueryResultLike<TRow>>;
  withTransaction<T>(callback: (client: QueryClient) => Promise<T>): Promise<T>;
}

interface SessionRow {
  id: string;
  project_id: string;
  mode: string;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
  last_error: string | null;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: unknown;
  created_at: Date | string;
}

interface QuestionRow {
  id: string;
  session_id: string;
  prompt: string;
  options: string[];
  status: string;
  decision: string | null;
  created_at: Date | string;
  resolved_at: Date | string | null;
}

interface DecisionRow {
  id: string;
  session_id: string;
  question_id: string;
  actor: string;
  selected_option: string;
  rationale: string;
  created_at: Date | string;
}

interface CountRow {
  count: number;
}

export class AiSessionService {
  private databaseService: DatabaseService;

  constructor({ databaseService }: { databaseService: DatabaseService }) {
    this.databaseService = databaseService;
  }

  async createOrGetActiveSession(projectId: string, mode = 'navigator'): Promise<SessionRecord> {
    const normalizedMode = normalizeMode(mode);

    return this.databaseService.withTransaction(async (client) => {
      await assertProjectExists(client, projectId);

      const existing = await client.query<SessionRow>(
        `
          SELECT id, project_id, mode, status, created_at, updated_at, last_error
          FROM project_ai_sessions
          WHERE project_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [projectId]
      );

      if (existing.rowCount > 0) {
        return toSession(existing.rows[0]);
      }

      const sessionId = nanoid(12);
      const insert = await client.query<SessionRow>(
        `
          INSERT INTO project_ai_sessions (id, project_id, mode, status)
          VALUES ($1, $2, $3, 'active')
          RETURNING id, project_id, mode, status, created_at, updated_at, last_error
        `,
        [sessionId, projectId, normalizedMode]
      );

      return toSession(insert.rows[0]);
    });
  }

  async getSession(projectId: string, sessionId: string): Promise<SessionRecord> {
    const { rows } = await this.databaseService.query<SessionRow>(
      `
        SELECT id, project_id, mode, status, created_at, updated_at, last_error
        FROM project_ai_sessions
        WHERE id = $1 AND project_id = $2
      `,
      [sessionId, projectId]
    );

    const row = rows[0];
    if (!row) {
      throw notFound(`AI session not found: ${sessionId}`);
    }

    return toSession(row);
  }

  async appendMessage(sessionId: string, role: string, content: unknown): Promise<MessageRecord> {
    const messageId = nanoid(12);
    const { rows } = await this.databaseService.query<MessageRow>(
      `
        INSERT INTO project_ai_messages (id, session_id, role, content)
        VALUES ($1, $2, $3, $4::jsonb)
        RETURNING id, session_id, role, content, created_at
      `,
      [messageId, sessionId, role, JSON.stringify(content)]
    );

    return toMessage(rows[0]);
  }

  async listHistory(projectId: string, sessionId: string, options: { limit?: number; offset?: number } = {}): Promise<SessionHistoryRecord> {
    const session = await this.getSession(projectId, sessionId);
    const normalizedLimit = normalizePositiveInt(options.limit);
    const normalizedOffset = normalizeNonNegativeInt(options.offset, 0);

    const [messagesResult, messageCountResult, questionsResult, decisionsResult] = await Promise.all([
      normalizedLimit
        ? this.databaseService.query<MessageRow>(
            `
              SELECT id, session_id, role, content, created_at
              FROM project_ai_messages
              WHERE session_id = $1
              ORDER BY created_at DESC
              OFFSET $2
              LIMIT $3
            `,
            [sessionId, normalizedOffset, normalizedLimit]
          )
        : this.databaseService.query<MessageRow>(
            `
              SELECT id, session_id, role, content, created_at
              FROM project_ai_messages
              WHERE session_id = $1
              ORDER BY created_at ASC
            `,
            [sessionId]
          ),
      this.databaseService.query<CountRow>(
        `
          SELECT COUNT(*)::int AS count
          FROM project_ai_messages
          WHERE session_id = $1
        `,
        [sessionId]
      ),
      this.databaseService.query<QuestionRow>(
        `
          SELECT id, session_id, prompt, options, status, decision, created_at, resolved_at
          FROM project_ai_questions
          WHERE session_id = $1
          ORDER BY created_at ASC
        `,
        [sessionId]
      ),
      this.databaseService.query<DecisionRow>(
        `
          SELECT id, session_id, question_id, actor, selected_option, rationale, created_at
          FROM project_ai_decisions
          WHERE session_id = $1
          ORDER BY created_at ASC
        `,
        [sessionId]
      )
    ]);

    const totalMessages = messageCountResult.rows[0]?.count ?? 0;
    const messageRows = normalizedLimit ? [...messagesResult.rows].reverse() : messagesResult.rows;
    const loadedMessages = normalizedLimit ? normalizedOffset + messageRows.length : totalMessages;

    return {
      session,
      messages: messageRows.map(toMessage),
      questions: questionsResult.rows.map(toQuestion),
      decisions: decisionsResult.rows.map(toDecision),
      hasMoreMessages: loadedMessages < totalMessages,
      totalMessages
    };
  }

  async createQuestion(sessionId: string, { prompt, options }: { prompt: string; options?: string[] }): Promise<QuestionRecord> {
    const questionId = nanoid(12);
    const { rows } = await this.databaseService.query<QuestionRow>(
      `
        INSERT INTO project_ai_questions (id, session_id, prompt, options)
        VALUES ($1, $2, $3, $4::jsonb)
        RETURNING id, session_id, prompt, options, status, decision, created_at, resolved_at
      `,
      [questionId, sessionId, prompt, JSON.stringify(options ?? [])]
    );

    return toQuestion(rows[0]);
  }

  async resolveQuestion(
    sessionId: string,
    questionId: string,
    { actor = 'user', selectedOption, rationale = '' }: { actor?: string; selectedOption: string; rationale?: string }
  ): Promise<QuestionRecord> {
    if (!selectedOption?.trim()) {
      throw new Error('selectedOption is required');
    }

    return this.databaseService.withTransaction(async (client) => {
      const question = await client.query<QuestionRow>(
        `
          SELECT id, session_id, prompt, options, status, decision, created_at, resolved_at
          FROM project_ai_questions
          WHERE id = $1 AND session_id = $2
          FOR UPDATE
        `,
        [questionId, sessionId]
      );

      if (question.rowCount === 0) {
        throw notFound(`Question not found: ${questionId}`);
      }

      const row = question.rows[0];
      if (row.status === 'resolved') {
        return toQuestion(row);
      }

      const decisionId = nanoid(12);
      await client.query(
        `
          INSERT INTO project_ai_decisions (
            id,
            session_id,
            question_id,
            actor,
            selected_option,
            rationale
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [decisionId, sessionId, questionId, actor, selectedOption.trim(), rationale]
      );

      const updated = await client.query<QuestionRow>(
        `
          UPDATE project_ai_questions
          SET status = 'resolved', decision = $3, resolved_at = NOW()
          WHERE id = $1 AND session_id = $2
          RETURNING id, session_id, prompt, options, status, decision, created_at, resolved_at
        `,
        [questionId, sessionId, selectedOption.trim()]
      );

      return toQuestion(updated.rows[0]);
    });
  }

  async markSessionStatus(sessionId: string, status: string, lastError: string | null = null) {
    await this.databaseService.query(
      `
        UPDATE project_ai_sessions
        SET status = $2, last_error = $3, updated_at = NOW()
        WHERE id = $1
      `,
      [sessionId, status, lastError]
    );
  }

  async addCheckpoint(sessionId: string, nodeName: string, graphState: unknown) {
    const checkpointId = nanoid(12);
    await this.databaseService.query(
      `
        INSERT INTO project_ai_checkpoints (id, session_id, node_name, graph_state)
        VALUES ($1, $2, $3, $4::jsonb)
      `,
      [checkpointId, sessionId, nodeName, JSON.stringify(graphState ?? {})]
    );
  }
}

function normalizeMode(mode: string) {
  const normalized = String(mode ?? 'navigator').trim().toLowerCase();
  return normalized === 'autopilot' ? 'autopilot' : 'navigator';
}

async function assertProjectExists(client: QueryClient, projectId: string) {
  const { rowCount } = await client.query('SELECT 1 FROM projects WHERE id = $1', [projectId]);
  if (rowCount === 0) {
    throw notFound(`Project not found: ${projectId}`);
  }
}

function toSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    mode: row.mode,
    status: row.status,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    lastError: row.last_error
  };
}

function toMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    createdAt: toIsoString(row.created_at)
  };
}

function toQuestion(row: QuestionRow): QuestionRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    prompt: row.prompt,
    options: row.options ?? [],
    status: row.status,
    decision: row.decision,
    createdAt: toIsoString(row.created_at),
    resolvedAt: row.resolved_at ? toIsoString(row.resolved_at) : null
  };
}

function toDecision(row: DecisionRow): DecisionRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    questionId: row.question_id,
    actor: row.actor,
    selectedOption: row.selected_option,
    rationale: row.rationale,
    createdAt: toIsoString(row.created_at)
  };
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizePositiveInt(input: number | undefined) {
  const parsed = Number.parseInt(String(input ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function normalizeNonNegativeInt(input: number | undefined, fallback = 0) {
  const parsed = Number.parseInt(String(input ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function notFound(message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 404;
  return error;
}