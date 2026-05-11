const DEFAULT_LANGSMITH_PROJECT = 'ai-3d-modeling';

export interface LangSmithRuntimeConfig {
  enabled: boolean;
  apiKey: string | null;
  project: string;
}

export function configureLangSmithTracing(env: NodeJS.ProcessEnv = process.env): LangSmithRuntimeConfig {
  const apiKey = (env.LANGSMITH_API_KEY ?? env.LANGCHAIN_API_KEY ?? '').trim() || null;
  const project = (
    env.LANGSMITH_PROJECT ??
    env.LANGCHAIN_PROJECT ??
    DEFAULT_LANGSMITH_PROJECT
  ).trim();

  if (!apiKey) {
    return {
      enabled: false,
      apiKey: null,
      project
    };
  }

  env.LANGSMITH_API_KEY = apiKey;
  env.LANGCHAIN_API_KEY = apiKey;
  env.LANGSMITH_TRACING = 'true';
  env.LANGCHAIN_TRACING_V2 = 'true';
  env.LANGSMITH_PROJECT = project;
  env.LANGCHAIN_PROJECT = project;

  return {
    enabled: true,
    apiKey,
    project
  };
}
