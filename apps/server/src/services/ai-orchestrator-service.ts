import { normalizeDsl } from '@ai3d/shared';
import type { QuestionRecord } from '@ai3d/shared/types';
import OpenAI from 'openai';

import type { ChatMessage, NormalizedDsl } from './ai-providers/shared.js';
import {
  CHAT_REPLY_PROMPT,
  CLARIFY_PROMPT,
  EXECUTE_STEP_PROMPT,
  INTENT_CLASSIFIER_PROMPT,
  PLAN_STEPS_PROMPT
} from './ai-providers/shared.js';
import { AgentToolsService } from './agent-tools-service.js';

// ─── Types ─────────────────────────────────────────────────────────────────

export type AgentEmit = (event: string, payload: unknown) => void;

interface OrchestratorState {
  projectId: string;
  sessionId: string;
  baselineVersionId?: string | null;
  mode: 'navigator' | 'autopilot';
  userMessage: string;
  conversationHistory: ChatMessage[];
  currentDsl?: NormalizedDsl;
  draftDsl?: NormalizedDsl;
  intent?: 'chat' | 'clarify' | 'generate';
  steps?: string[];
  haltedForQuestion: boolean;
  question?: QuestionRecord | { prompt: string; options: string[] };
  updatedProject?: ProjectLike | null;
}

interface ProjectLike {
  dsl: NormalizedDsl;
  currentVersion?: { versionNumber?: number } | null;
  [key: string]: unknown;
}

interface AiProviderServiceLike {
  generateDsl(input: { prompt?: string; currentDsl?: unknown }): Promise<NormalizedDsl>;
  streamChat(input: { messages: ChatMessage[]; onToken: (delta: string) => void }): Promise<string>;
}

interface ProjectServiceLike {
  getProject(projectId: string): Promise<ProjectLike>;
  saveDsl(projectId: string, dslInput: unknown, options?: { source?: string }): Promise<ProjectLike>;
}

interface AiSessionServiceLike {
  markSessionStatus(sessionId: string, status: string, lastError?: string | null): Promise<void>;
  hasUserMessageRequestId(sessionId: string, requestId: string): Promise<boolean>;
  appendMessage(sessionId: string, role: string, content: unknown): Promise<unknown>;
  resolvePendingQuestions(sessionId: string, options?: { decision?: string }): Promise<unknown>;
  listHistory(
    projectId: string,
    sessionId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ messages: Array<{ role: string; content?: unknown }> }>;
  resolveQuestion(
    sessionId: string,
    questionId: string,
    payload: { actor?: string; selectedOption: string; rationale?: string }
  ): Promise<QuestionRecord>;
  addCheckpoint(sessionId: string, nodeName: string, graphState: unknown): Promise<void>;
  createQuestion(
    sessionId: string,
    payload: { prompt: string; options?: string[] }
  ): Promise<QuestionRecord>;
}

interface AiStreamServiceLike {
  emit(sessionId: string, event: string, payload: unknown): string | null;
}

interface AgentToolsServiceLike {
  validateStructure(dslInput: unknown): {
    dsl: NormalizedDsl | null;
    errors: Array<{ code: string; message: string; nodeId?: string }>;
  };
  analyzeGeometry(dslInput: unknown): {
    nodeCount: number;
    kindCounts: Record<string, number>;
    overlaps: Array<{ a: string; b: string }>;
    worldBounds: unknown;
  };
  rollback(projectId: string, versionId: string): Promise<unknown>;
}

// ─── Service ───────────────────────────────────────────────────────────────

export class AiOrchestratorService {
  private aiProviderService: AiProviderServiceLike;
  private projectService: ProjectServiceLike;
  private aiSessionService: AiSessionServiceLike;
  private aiStreamService: AiStreamServiceLike;
  private agentToolsService: AgentToolsServiceLike;
  private openaiClient: OpenAI | null = null;
  private openaiModel = 'gpt-4o-mini';

  constructor({
    aiProviderService,
    projectService,
    aiSessionService,
    aiStreamService,
    agentToolsService,
    openaiApiKey,
    openaiModel
  }: {
    aiProviderService: AiProviderServiceLike;
    projectService: ProjectServiceLike;
    aiSessionService: AiSessionServiceLike;
    aiStreamService: AiStreamServiceLike;
    agentToolsService?: AgentToolsServiceLike;
    openaiApiKey?: string;
    openaiModel?: string;
  }) {
    this.aiProviderService = aiProviderService;
    this.projectService = projectService;
    this.aiSessionService = aiSessionService;
    this.aiStreamService = aiStreamService;
    this.agentToolsService =
      agentToolsService ?? new AgentToolsService({ projectService: this.projectService as any });
    
    if (openaiApiKey) {
      this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
    }
    if (openaiModel) {
      this.openaiModel = openaiModel;
    }
  }

  private getOpenAIClient(): OpenAI {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized. Provide openaiApiKey in constructor.');
    }
    return this.openaiClient;
  }

  private async callOpenAI({
    messages,
    onToken
  }: {
    messages: ChatMessage[];
    onToken: (delta: string) => void;
  }): Promise<string> {
    const client = this.getOpenAIClient();
    const stream = await client.chat.completions.create({
      model: this.openaiModel,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      stream: true
    });

    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        onToken(delta);
      }
    }
    return full;
  }

  // ── Public entry points ──────────────────────────────────────────────────

  async runTurn({
    projectId,
    sessionId,
    mode,
    userMessage,
    requestId,
    emit
  }: {
    projectId: string;
    sessionId: string;
    mode?: string;
    userMessage?: string;
    requestId?: string;
    emit?: AgentEmit;
  }) {
    const prompt = String(userMessage ?? '').trim();
    if (!prompt) {
      throw new Error('Message is required');
    }

    const agentEmit: AgentEmit =
      emit ??
      ((event, payload) => {
        this.aiStreamService.emit(sessionId, event, payload);
      });

    const dedupeRequestId = String(requestId ?? '').trim();
    if (dedupeRequestId) {
      const isDuplicate = await this.aiSessionService.hasUserMessageRequestId(sessionId, dedupeRequestId);
      if (isDuplicate) {
        agentEmit('run.completed', { status: 'duplicate_ignored' });
        return {
          status: 'duplicate_ignored',
          mode: normalizeMode(mode)
        };
      }
    }

    await this.aiSessionService.markSessionStatus(sessionId, 'active');
    await this.aiSessionService.resolvePendingQuestions(sessionId, { decision: 'superseded' });
    await this.aiSessionService.appendMessage(sessionId, 'user', {
      text: prompt,
      ...(dedupeRequestId ? { requestId: dedupeRequestId } : {})
    });

    try {
      const resultState = await this.runGraph(
        {
          projectId,
          sessionId,
          mode: normalizeMode(mode),
          userMessage: prompt,
          conversationHistory: [],
          haltedForQuestion: false
        },
        agentEmit
      );

      if (resultState.haltedForQuestion) {
        await this.aiSessionService.markSessionStatus(sessionId, 'waiting_user');
        return { status: 'waiting_user', question: resultState.question, mode: resultState.mode };
      }

      await this.aiSessionService.markSessionStatus(sessionId, 'completed');
      agentEmit('run.completed', { status: 'completed' });

      return {
        status: 'completed',
        project: resultState.updatedProject,
        mode: resultState.mode
      };
    } catch (error) {
      const message = getErrorMessage(error);
      await this.aiSessionService.markSessionStatus(sessionId, 'failed', message);
      agentEmit('run.failed', { message });
      throw error;
    }
  }

  async continueFromDecision({
    projectId,
    sessionId,
    questionId,
    selectedOption,
    rationale = '',
    emit
  }: {
    projectId: string;
    sessionId: string;
    questionId: string;
    selectedOption: string;
    rationale?: string;
    emit?: AgentEmit;
  }) {
    const resolvedQuestion = await this.aiSessionService.resolveQuestion(sessionId, questionId, {
      actor: 'user',
      selectedOption,
      rationale
    });

    const agentEmit: AgentEmit =
      emit ??
      ((event, payload) => {
        this.aiStreamService.emit(sessionId, event, payload);
      });

    agentEmit('ai.question.resolved', {
      questionId,
      selectedOption: resolvedQuestion.decision
    });

    return this.runTurn({
      projectId,
      sessionId,
      mode: 'navigator',
      userMessage: `User chose: ${resolvedQuestion.decision}`,
      emit: agentEmit
    });
  }

  // ── LangGraph ─────────────────────────────────────────────────────────────

  private async runGraph(
    initialState: OrchestratorState,
    emit: AgentEmit
  ): Promise<OrchestratorState> {
    try {
      const langgraph = await import('@langchain/langgraph');
      const { Annotation, END, START, StateGraph } = langgraph;

      const GraphState = Annotation.Root({
        projectId: Annotation(),
        sessionId: Annotation(),
        baselineVersionId: Annotation(),
        mode: Annotation(),
        userMessage: Annotation(),
        conversationHistory: Annotation(),
        currentDsl: Annotation(),
        draftDsl: Annotation(),
        intent: Annotation(),
        steps: Annotation(),
        haltedForQuestion: Annotation(),
        question: Annotation(),
        updatedProject: Annotation()
      });

      const graph = new StateGraph(GraphState)
        .addNode('load_context', (s) => this.nodeLoadContext(s as OrchestratorState, emit))
        .addNode('classify_intent', (s) => this.nodeClassifyIntent(s as OrchestratorState, emit))
        .addNode('chat_reply', (s) => this.nodeChatReply(s as OrchestratorState, emit))
        .addNode('ask_clarify', (s) => this.nodeAskClarify(s as OrchestratorState, emit))
        .addNode('plan_steps', (s) => this.nodePlanSteps(s as OrchestratorState, emit))
        .addNode('execute_steps', (s) => this.nodeExecuteSteps(s as OrchestratorState, emit))
        .addNode('validate_dsl', (s) => this.nodeValidateDsl(s as OrchestratorState, emit))
        .addNode('commit_version', (s) => this.nodeCommitVersion(s as OrchestratorState, emit))
        .addEdge(START, 'load_context')
        .addEdge('load_context', 'classify_intent')
        .addConditionalEdges('classify_intent', ((s: unknown) => routeByIntent(s as OrchestratorState)) as any)
        .addEdge('chat_reply', END)
        .addEdge('ask_clarify', END)
        .addEdge('plan_steps', 'execute_steps')
        .addEdge('execute_steps', 'validate_dsl')
        .addEdge('validate_dsl', 'commit_version')
        .addEdge('commit_version', END)
        .compile();

      return (await graph.invoke(
        { ...initialState },
        {
          runName: 'ai-3d-modeling.langgraph.orchestrator',
          tags: ['ai-3d-modeling', 'langgraph', 'orchestrator'],
          metadata: {
            project_id: initialState.projectId,
            session_id: initialState.sessionId,
            mode: initialState.mode,
            prompt_profile: 'engineering_management'
          }
        }
      )) as OrchestratorState;
    } catch {
      return this.runSequential(initialState, emit);
    }
  }

  private async runSequential(
    state: OrchestratorState,
    emit: AgentEmit
  ): Promise<OrchestratorState> {
    let s = await this.nodeLoadContext(state, emit);
    s = await this.nodeClassifyIntent(s, emit);

    if (s.intent === 'chat') return this.nodeChatReply(s, emit);
    if (s.intent === 'clarify') return this.nodeAskClarify(s, emit);

    s = await this.nodePlanSteps(s, emit);
    s = await this.nodeExecuteSteps(s, emit);
    s = await this.nodeValidateDsl(s, emit);
    s = await this.nodeCommitVersion(s, emit);
    return s;
  }

  // ── Nodes ─────────────────────────────────────────────────────────────────

  private async nodeLoadContext(
    state: OrchestratorState,
    emit: AgentEmit
  ): Promise<OrchestratorState> {
    emit('agent.thinking', { step: 'load_context', message: '加载项目上下文...' });

    const project = await this.projectService.getProject(state.projectId);

    const historyRecord = await this.aiSessionService.listHistory(
      state.projectId,
      state.sessionId,
      { limit: 10, offset: 0 }
    );

    const conversationHistory: ChatMessage[] = (historyRecord.messages ?? [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: extractMessageText(m.content)
      }));

    // Resolve [node:id name=X] references in the user message and inject context
    const currentDsl = (project as ProjectLike).dsl;
    const nodeRefPattern = /\[node:([^\s\]]+)(?:\s+name=([^\]]+))?\]/g;
    const referencedNodes: Array<{ id: string; name: string; node: unknown }> = [];
    let refMatch: RegExpExecArray | null;
    while ((refMatch = nodeRefPattern.exec(state.userMessage)) !== null) {
      const nodeId = refMatch[1];
      const nodeName = refMatch[2] ?? nodeId;
      const node = (currentDsl as any)?.nodes?.find((n: any) => n.id === nodeId);
      if (node) referencedNodes.push({ id: nodeId, name: nodeName, node });
    }

    let enrichedUserMessage = state.userMessage;
    if (referencedNodes.length > 0) {
      const nodeContext = referencedNodes
        .map((r) => `节点 @${r.name} (id=${r.id}): ${JSON.stringify(r.node)}`)
        .join('\n');
      enrichedUserMessage = `${state.userMessage}\n\n[Referenced nodes]\n${nodeContext}`;
    }

    await this.aiSessionService.addCheckpoint(state.sessionId, 'load_context', {
      mode: state.mode,
      currentVersion: (project as ProjectLike).currentVersion?.versionNumber ?? null,
      historyLength: conversationHistory.length
    });

    return {
      ...state,
      baselineVersionId: ((project as ProjectLike).currentVersion as any)?.id ?? null,
      mode: normalizeMode(state.mode),
      userMessage: enrichedUserMessage,
      currentDsl,
      conversationHistory,
      updatedProject: null
    };
  }

  private async nodeClassifyIntent(
    state: OrchestratorState,
    emit: AgentEmit
  ): Promise<OrchestratorState> {
    emit('agent.thinking', { step: 'classify_intent', message: '分析意图...' });

    const messages: ChatMessage[] = [
      { role: 'system', content: INTENT_CLASSIFIER_PROMPT },
      ...state.conversationHistory.slice(-6),
      { role: 'user', content: state.userMessage }
    ];

    try {
      const raw = await this.callOpenAI({ messages, onToken: () => {} });
      const parsed = JSON.parse(extractJson(raw)) as { intent?: string };
      const intent = normalizeIntent(parsed.intent);
      emit('agent.thinking', { step: 'classify_intent', message: `意图: ${intent}` });
      return { ...state, intent };
    } catch {
      return { ...state, intent: 'generate' };
    }
  }

  private async nodeChatReply(
    state: OrchestratorState,
    emit: AgentEmit
  ): Promise<OrchestratorState> {
    emit('agent.thinking', { step: 'chat_reply', message: '生成回复...' });

    const messages: ChatMessage[] = [
      { role: 'system', content: CHAT_REPLY_PROMPT },
      ...state.conversationHistory.slice(-8),
      { role: 'user', content: state.userMessage }
    ];

    const fullText = await this.callOpenAI({
      messages,
      onToken: (delta) => emit('agent.token', { delta })
    });

    emit('agent.token_done', { text: fullText });
    await this.aiSessionService.appendMessage(state.sessionId, 'assistant', { text: fullText });

    return state;
  }

  private async nodeAskClarify(
    state: OrchestratorState,
    emit: AgentEmit
  ): Promise<OrchestratorState> {
    emit('agent.thinking', { step: 'ask_clarify', message: '生成澄清问题...' });

    const messages: ChatMessage[] = [
      { role: 'system', content: CLARIFY_PROMPT },
      ...state.conversationHistory.slice(-6),
      { role: 'user', content: state.userMessage }
    ];

    try {
      const raw = await this.callOpenAI({ messages, onToken: () => {} });
      const parsed = JSON.parse(extractJson(raw)) as { question?: string; options?: string[] };
      const questionText = parsed.question ?? '请提供更多细节';
      const options = parsed.options ?? ['继续', '取消'];

      if (state.mode === 'navigator') {
        const question = await this.aiSessionService.createQuestion(state.sessionId, {
          prompt: questionText,
          options
        });
        emit('ai.question.required', question);
        await this.aiSessionService.appendMessage(state.sessionId, 'assistant', {
          text: questionText,
          type: 'question'
        });
        return { ...state, haltedForQuestion: true, question };
      }

      // Autopilot: resolve automatically
      const question = await this.aiSessionService.createQuestion(state.sessionId, {
        prompt: questionText,
        options
      });
      await this.aiSessionService.resolveQuestion(state.sessionId, question.id, {
        actor: 'model',
        selectedOption: options[0],
        rationale: 'Autopilot selected first option.'
      });
      emit('ai.question.resolved', { questionId: question.id, selectedOption: options[0] });

      return {
        ...state,
        intent: 'generate',
        userMessage: `${state.userMessage} (clarified: ${options[0]})`
      };
    } catch {
      return { ...state, intent: 'generate' };
    }
  }

  private async nodePlanSteps(
    state: OrchestratorState,
    emit: AgentEmit
  ): Promise<OrchestratorState> {
    emit('agent.thinking', { step: 'plan_steps', message: '规划执行步骤...' });

    const messages: ChatMessage[] = [
      { role: 'system', content: PLAN_STEPS_PROMPT },
      ...state.conversationHistory.slice(-6),
      {
        role: 'user',
        content: JSON.stringify({
          request: state.userMessage,
          currentDslSummary: summarizeDsl(state.currentDsl)
        })
      }
    ];

    let steps: string[] = [];
    try {
      const raw = await this.callOpenAI({ messages, onToken: () => {} });
      const parsed = JSON.parse(extractJson(raw)) as { steps?: string[] };
      steps =
        Array.isArray(parsed.steps) && parsed.steps.length > 0
          ? parsed.steps.slice(0, 5)
          : [state.userMessage];
    } catch {
      steps = [state.userMessage];
    }

    emit('agent.plan', { steps });

    return { ...state, steps };
  }

  private async nodeExecuteSteps(
    state: OrchestratorState,
    emit: AgentEmit
  ): Promise<OrchestratorState> {
    const steps = state.steps ?? [state.userMessage];
    let workingDsl = state.currentDsl;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      emit('agent.step_start', {
        index: i,
        total: steps.length,
        description: step
      });

      const messages: ChatMessage[] = [
        { role: 'system', content: EXECUTE_STEP_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            step,
            currentDsl: workingDsl,
            originalRequest: state.userMessage
          })
        }
      ];

      try {
        const beforeDsl = workingDsl;
        const rawDsl = await this.callOpenAI({
          messages,
          onToken: (delta) => emit('agent.token', { delta })
        });
        emit('agent.token_done', { text: rawDsl });

        const parsed = JSON.parse(extractJson(rawDsl));
        workingDsl = normalizeDsl(parsed) as NormalizedDsl;

        const focusNodeId = pickFocusNodeId(beforeDsl, workingDsl);
        if (focusNodeId) {
          emit('viewport.change', { nodeId: focusNodeId, reason: 'step_update', stepIndex: i });
        }

        // For multi-step: save partial and signal frontend after each intermediate step
        if (i < steps.length - 1) {
          const partialProject = await this.projectService.saveDsl(state.projectId, workingDsl, {
            source: 'ai-partial'
          });
          emit('dsl.partial', {
            projectId: state.projectId,
            stepIndex: i,
            totalSteps: steps.length,
            versionNumber:
              (partialProject as ProjectLike).currentVersion?.versionNumber ?? null
          });
        }
      } catch {
        emit('agent.thinking', {
          step: `execute_step_${i + 1}`,
          message: `步骤 ${i + 1} 解析失败，跳过`
        });
      }
    }

    await this.aiSessionService.addCheckpoint(state.sessionId, 'execute_steps', {
      stepsCompleted: steps.length
    });

    return { ...state, draftDsl: workingDsl };
  }

  private async nodeValidateDsl(
    state: OrchestratorState,
    emit: AgentEmit
  ): Promise<OrchestratorState> {
    if (state.haltedForQuestion) {
      return state;
    }

    const validation = this.agentToolsService.validateStructure(state.draftDsl ?? state.currentDsl);
    const normalized = (validation.dsl ?? normalizeDsl(state.draftDsl ?? state.currentDsl)) as NormalizedDsl;
    const geometry = this.agentToolsService.analyzeGeometry(normalized);
    const overlapNodeIds = Array.from(
      new Set(geometry.overlaps.flatMap((pair) => [pair.a, pair.b]).filter(Boolean))
    );

    if (validation.errors.length > 0) {
      const invalidNodeIds = Array.from(
        new Set(validation.errors.map((item) => item.nodeId).filter((id): id is string => Boolean(id)))
      );
      if (invalidNodeIds.length > 0) {
        emit('scene.highlight', {
          nodeIds: invalidNodeIds,
          color: '#ff4d4f',
          reason: 'validation_error'
        });
      }

      if (state.baselineVersionId) {
        try {
          const rollbackProject = (await this.agentToolsService.rollback(
            state.projectId,
            state.baselineVersionId
          )) as ProjectLike;
          emit('dsl.rollback', {
            projectId: state.projectId,
            versionId: state.baselineVersionId,
            versionNumber: (rollbackProject.currentVersion as any)?.versionNumber ?? null,
            reason: 'critical_validation_failed'
          });
          await this.aiSessionService.addCheckpoint(state.sessionId, 'validate_dsl', {
            nodeCount: normalized.nodes.length,
            errors: validation.errors,
            overlapCount: geometry.overlaps.length,
            rolledBackTo: state.baselineVersionId
          });
          return {
            ...state,
            draftDsl: normalizeDsl((rollbackProject as any).dsl) as NormalizedDsl,
            updatedProject: rollbackProject
          };
        } catch {
          emit('agent.thinking', {
            step: 'validate_dsl',
            message: '回滚失败，继续使用当前草稿。'
          });
        }
      }
    }

    if (overlapNodeIds.length > 0) {
      emit('scene.highlight', {
        nodeIds: overlapNodeIds,
        color: '#faad14',
        reason: 'geometry_overlap'
      });
    }

    await this.aiSessionService.addCheckpoint(state.sessionId, 'validate_dsl', {
      nodeCount: normalized.nodes.length,
      errors: validation.errors,
      overlapCount: geometry.overlaps.length,
      kindCounts: geometry.kindCounts
    });

    return { ...state, draftDsl: normalized as NormalizedDsl };
  }

  private async nodeCommitVersion(
    state: OrchestratorState,
    emit: AgentEmit
  ): Promise<OrchestratorState> {
    if (state.haltedForQuestion) {
      return state;
    }

    const updatedProject =
      state.updatedProject ??
      (await this.projectService.saveDsl(state.projectId, state.draftDsl, {
        source: state.mode === 'autopilot' ? 'ai-autopilot' : 'ai-navigator'
      }));

    const versionNumber =
      (updatedProject as ProjectLike).currentVersion?.versionNumber ?? null;

    // Broadcast dsl.committed to all subscribers (other browser tabs)
    this.aiStreamService.emit(state.sessionId, 'dsl.committed', {
      projectId: state.projectId,
      versionNumber
    });

    await this.aiSessionService.appendMessage(state.sessionId, 'assistant', {
      text: 'DSL updated successfully.',
      type: 'commit',
      version: (updatedProject as ProjectLike).currentVersion ?? null
    });

    await this.aiSessionService.addCheckpoint(state.sessionId, 'commit_version', {
      committedVersion: versionNumber
    });

    return { ...state, updatedProject: updatedProject as ProjectLike };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function routeByIntent(state: OrchestratorState): string {
  if (state.intent === 'chat') return 'chat_reply';
  if (state.intent === 'clarify') return 'ask_clarify';
  return 'plan_steps';
}

function normalizeMode(mode: string | undefined): 'navigator' | 'autopilot' {
  return String(mode ?? 'navigator').trim().toLowerCase() === 'autopilot'
    ? 'autopilot'
    : 'navigator';
}

function normalizeIntent(intent: string | undefined): 'chat' | 'clarify' | 'generate' {
  const v = String(intent ?? '').trim().toLowerCase();
  if (v === 'chat') return 'chat';
  if (v === 'clarify') return 'clarify';
  return 'generate';
}

function extractJson(raw: string): string {
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : raw;
}

function summarizeDsl(dsl: NormalizedDsl | undefined): string {
  if (!dsl) return 'empty scene';
  const nodeCount = dsl.nodes?.length ?? 0;
  const kinds = [...new Set((dsl.nodes ?? []).map((n) => n.kind))].join(', ');
  return `${nodeCount} nodes (${kinds || 'none'})`;
}

function pickFocusNodeId(
  beforeDsl: NormalizedDsl | undefined,
  afterDsl: NormalizedDsl | undefined
): string | null {
  const beforeIds = new Set((beforeDsl?.nodes ?? []).map((n) => n.id));
  const afterNodes = afterDsl?.nodes ?? [];

  const newlyAdded = afterNodes.find((node) => !beforeIds.has(node.id));
  if (newlyAdded?.id) {
    return newlyAdded.id;
  }

  const lastNode = afterNodes[afterNodes.length - 1];
  return lastNode?.id ?? null;
}

function extractMessageText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object' && content !== null && 'text' in content) {
    return String((content as { text: unknown }).text ?? '');
  }
  return JSON.stringify(content);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
