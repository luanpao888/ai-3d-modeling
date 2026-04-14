import { createHttpClient, type ApiClient } from './httpClient';

export type {
  ApiClient,
  AssetRecord,
  DecisionRecord,
  MessageRecord,
  ProjectRecord,
  QuestionRecord,
  SessionHistoryRecord,
  SessionRecord,
  VersionRecord
} from './httpClient';

export function createApiClient(): ApiClient {
  return createHttpClient();
}