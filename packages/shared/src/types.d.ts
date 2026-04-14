export interface SessionRecord {
  id: string;
  projectId: string;
  mode: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  lastError?: string | null;
}

export interface MessageRecord {
  id: string;
  sessionId?: string;
  role: string;
  content: unknown;
  createdAt?: string;
}

export interface QuestionRecord {
  id: string;
  sessionId?: string;
  prompt: string;
  options: string[];
  status?: string;
  decision?: string | null;
  createdAt?: string;
  resolvedAt?: string | null;
}

export interface DecisionRecord {
  id: string;
  sessionId?: string;
  questionId?: string;
  actor?: string;
  selectedOption: string;
  rationale?: string;
  createdAt?: string;
}

export interface SessionHistoryRecord {
  session: SessionRecord;
  messages: MessageRecord[];
  questions: QuestionRecord[];
  decisions: DecisionRecord[];
  hasMoreMessages?: boolean;
  totalMessages?: number;
}

export interface DslNode {
  id: string;
  kind: 'primitive' | 'asset';
  name?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  primitive?: 'box' | 'sphere' | 'cylinder' | 'plane';
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
  };
  assetId?: string;
  material?: {
    color?: string;
    metalness?: number;
    roughness?: number;
  };
}

export interface DslDocument {
  version: string;
  units: string;
  upAxis: string;
  metadata?: {
    sceneName?: string;
    prompt?: string;
  };
  nodes: DslNode[];
}

export interface ProjectVersionSummary {
  id: string;
  versionNumber: number;
  createdAt: string;
}

export interface ProjectVersionRecord extends ProjectVersionSummary {
  source?: string;
  prompt?: string | null;
  parentVersionId?: string | null;
  isCurrent?: boolean;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  units: string;
  upAxis: string;
  mainScene: string;
  createdAt: string;
  updatedAt: string;
  dsl?: DslDocument;
  currentVersion?: ProjectVersionRecord | ProjectVersionSummary | null;
}