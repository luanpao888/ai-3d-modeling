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

// ─── DSL Node base fields ────────────────────────────────────────────────────

interface DslNodeBase {
  id: string;
  /** Human-readable name assigned by AI. Used for @mention references in chat. */
  name?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  material?: {
    color?: string;
    metalness?: number;
    roughness?: number;
  };
}

export interface DslPrimitiveNode extends DslNodeBase {
  kind: 'primitive';
  primitive: 'box' | 'sphere' | 'cylinder' | 'plane';
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
  };
}

export interface DslAssetNode extends DslNodeBase {
  kind: 'asset';
  assetId: string;
}

/** Feature operations that compose a constructed node's geometry */
export interface DslFeature {
  op: 'profile' | 'extrude' | 'revolve' | 'sweep' | 'loft' | 'boolean' | 'fillet' | 'array';
  // profile
  shape?: 'circle' | 'rectangle' | 'ellipse' | 'polyline';
  radius?: number;
  width?: number;
  height?: number;
  /** 2D polyline points [x, y] for profile shape */
  points?: [number, number][];
  // extrude
  depth?: number;
  taper?: number;
  // revolve
  axis?: 'x' | 'y' | 'z';
  angle?: number;
  // sweep / loft
  pathNodeId?: string;
  profileNodeIds?: string[];
  // boolean
  operation?: 'union' | 'subtract' | 'intersect';
  targetNodeId?: string;
  // fillet
  edges?: 'all' | 'top' | 'bottom' | 'vertical';
  // array
  type?: 'linear' | 'circular' | 'grid';
  count?: number;
  spacing?: number;
  [key: string]: unknown;
}

export interface DslConstructedNode extends DslNodeBase {
  kind: 'constructed';
  geometry: {
    features: DslFeature[];
  };
}

export interface DslGroupNode extends DslNodeBase {
  kind: 'group';
  /** Ordered list of child node IDs owned by this group */
  children: string[];
}

export type DslNode = DslPrimitiveNode | DslAssetNode | DslGroupNode | DslConstructedNode;

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