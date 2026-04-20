import { normalizeDsl } from '@ai3d/shared';
import type { QuestionRecord } from '@ai3d/shared/types';

import type { ChatMessage, NormalizedDsl } from './ai-providers/shared.js';
import {
  CHAT_REPLY_PROMPT,
  CLARIFY_PROMPT,
  EXECUTE_STEP_PROMPT,
  INTENT_CLASSIFIER_PROMPT,
  PLAN_STEPS_PROMPT
} from './ai-providers/shared.js';

// ─── Types ─────────────────────────────────────────────────────────────────

export type AgentEmit = (event: string, payload: unknown) => void;

interface OrchestratorState {
  projectId: string;
  sessionId: string;
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
  appendMessage(sessionId: string, role: string, content: unknown): Promise<unknown>;
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

// ─── Service ───────────────────────────────────────────────────────────────

export class AiOrchestratorService {
  private aiProviderService: AiProviderServiceLike;
  private projectService: ProjectServiceLike;
  private aiSessionService: AiSessionServiceLike;
  private aiStreamService: AiStreamServiceLike;

  constructor({
    aiProviderService,
    projectService,
    aiSessionService,
    aiStreamService
  }: {
    aiProviderService: AiProviderServiceLike;
    projectService: ProjectServiceLike;
    aiSessionService: AiSessionServiceLike;
    aiStreamService: AiStreamServiceLike;
  }) {
    this.aiProviderService = aiProviderService;
    this.projectService = projectService;
    this.aiSessionService = aiSessionService;
    this.aiStreamService = aiStreamService;
  }

  // ── Public entry points ──────────────────────────────────────────────────

  async runTurn({
    projectId,
    sessionId,
    mode,
    userMessage,
    emit
  }: {
    projectId: string;
    sessionId: string;
    mode?: string;
    userMessage?: string;
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

    await this.aiSessionService.markSessionStatus(sessionId, 'active');
    await this.aiSessionService.appendMessage(sessionId, 'user', { text: prompt });

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
        .addNode('validate_dsl', (s) => this.nodeValidateDsl(s as OrchestratorState))
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

      return (await graph.invoke({ ...initialState })) as OrchestratorState;
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
    s = await this.nodeValidateDsl(s);
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

    await this.aiSessionService.addCheckpoint(state.sessionId, 'load_context', {
      mode: state.mode,
      currentVersion: (project as ProjectLike).currentVersion?.versionNumber ?? null,
      historyLength: conversationHistory.length
    });

    return {
      ...state,
      mode: normalizeMode(state.mode),
      currentDsl: (project as ProjectLike).dsl,
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
      const raw = await this.aiProviderService.streamChat({ messages, onToken: () => {} });
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

    const fullText = await this.aiProviderService.streamChat({
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
      const raw = await this.aiProviderService.streamChat({ messages, onToken: () => {} });
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
      const raw = await this.aiProviderService.streamChat({ messages, onToken: () => {} });
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
        const rawDsl = await this.aiProviderService.streamChat({
          messages,
          onToken: (delta) => emit('agent.token', { delta })
        });
        emit('agent.token_done', { text: rawDsl });

        const parsed = JSON.parse(extractJson(rawDsl));
        workingDsl = normalizeDsl(parsed) as NormalizedDsl;

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

  private async nodeValidateDsl(state: OrchestratorState): Promise<OrchestratorState> {
    if (state.haltedForQuestion) {
      return state;
    }

    const normalized = normalizeDsl(state.draftDsl ?? state.currentDsl);
    await this.aiSessionService.addCheckpoint(state.sessionId, 'validate_dsl', {
      nodeCount: normalized.nodes.length
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

    const updatedProject = await this.projectService.saveDsl(state.projectId, state.draftDsl, {
      source: state.mode === 'autopilot' ? 'ai-autopilot' : 'ai-navigator'
    });

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
