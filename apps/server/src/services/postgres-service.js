import { Pool } from 'pg';

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/ai_3d_modeling';

export class PostgresService {
  constructor(env = {}) {
    this.pool = new Pool(buildPoolConfig(env));
  }

  async initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        units TEXT NOT NULL DEFAULT 'meter',
        up_axis TEXT NOT NULL DEFAULT 'Y',
        main_scene TEXT NOT NULL DEFAULT 'db://dsl/current',
        current_version_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS project_dsl_versions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        dsl JSONB NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        prompt TEXT,
        parent_version_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (project_id, version_number)
      )
    `);

    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_project_dsl_versions_project_id ON project_dsl_versions(project_id)'
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_project_dsl_versions_project_id_created_at ON project_dsl_versions(project_id, created_at DESC)'
    );

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS project_ai_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        mode TEXT NOT NULL CHECK (mode IN ('navigator', 'autopilot')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'waiting_user', 'completed', 'failed')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_error TEXT
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS project_ai_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES project_ai_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
        content JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS project_ai_questions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES project_ai_sessions(id) ON DELETE CASCADE,
        prompt TEXT NOT NULL,
        options JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'cancelled')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        decision TEXT
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS project_ai_decisions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES project_ai_sessions(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL REFERENCES project_ai_questions(id) ON DELETE CASCADE,
        actor TEXT NOT NULL CHECK (actor IN ('user', 'model')),
        selected_option TEXT NOT NULL,
        rationale TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS project_ai_checkpoints (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES project_ai_sessions(id) ON DELETE CASCADE,
        node_name TEXT NOT NULL,
        graph_state JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_project_ai_sessions_one_active_per_project
       ON project_ai_sessions(project_id)
       WHERE status IN ('active', 'waiting_user')`
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_project_ai_messages_session_created_at ON project_ai_messages(session_id, created_at ASC)'
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_project_ai_questions_session_created_at ON project_ai_questions(session_id, created_at ASC)'
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_project_ai_checkpoints_session_created_at ON project_ai_checkpoints(session_id, created_at DESC)'
    );
  }

  async query(text, params = []) {
    return this.pool.query(text, params);
  }

  async withTransaction(callback) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

function buildPoolConfig(env) {
  const connectionString = env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
  const ssl = normalizeSslConfig(env.DATABASE_SSL);

  return {
    connectionString,
    ...(ssl ? { ssl } : {})
  };
}

function normalizeSslConfig(rawValue) {
  if (!rawValue) {
    return undefined;
  }

  const normalizedValue = String(rawValue).trim().toLowerCase();

  if (['1', 'true', 'yes', 'require'].includes(normalizedValue)) {
    return { rejectUnauthorized: false };
  }

  return undefined;
}