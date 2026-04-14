import { normalizeDsl } from '@ai3d/shared';
import type { QuestionRecord } from '@ai3d/shared/types';
import type { NormalizedDsl } from './ai-providers/shared.js';

interface AmbiguityQuestion {
  prompt: string;
  options: string[];
}

interface OrchestratorState {
  projectId: string;
  sessionId: string;
  mode: 'navigator' | 'autopilot';
  userMessage: string;
  currentDsl?: NormalizedDsl;
  draftDsl?: NormalizedDsl;
  needsDecision?: boolean;
  question?: AmbiguityQuestion;
  haltedForQuestion: boolean;
  updatedProject?: ProjectLike | null;
}

interface ProjectLike {
  dsl: NormalizedDsl;
  currentVersion?: { versionNumber?: number } | null;
  [key: string]: unknown;
}

interface AiProviderServiceLike {
  generateDsl(input: { prompt?: string; currentDsl?: unknown }): Promise<NormalizedDsl>;
}

interface ProjectServiceLike {
  getProject(projectId: string): Promise<ProjectLike>;
  saveDsl(projectId: string, dslInput: unknown, options?: { source?: string }): Promise<ProjectLike>;
}

interface AiSessionServiceLike {
  markSessionStatus(sessionId: string, status: string, lastError?: string | null): Promise<void>;
  appendMessage(sessionId: string, role: string, content: unknown): Promise<unknown>;
  resolveQuestion(
    sessionId: string,
    questionId: string,
    payload: { actor?: string; selectedOption: string; rationale?: string }
  ): Promise<QuestionRecord>;
  addCheckpoint(sessionId: string, nodeName: string, graphState: unknown): Promise<void>;
  createQuestion(sessionId: string, payload: AmbiguityQuestion): Promise<QuestionRecord>;
}

interface AiStreamServiceLike {
  emit(sessionId: string, event: string, payload: unknown): string | null;
}

export class AiOrchestratorService {
  private aiProviderService: AiProviderServiceLike;
  private projectService: ProjectServiceLike;
  private aiSessionService: AiSessionServiceLike;
  private aiStreamService: AiStreamServiceLike;

  constructor({ aiProviderService, projectService, aiSessionService, aiStreamService }: {
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

  async runTurn({ projectId, sessionId, mode, userMessage }: { projectId: string; sessionId: string; mode?: string; userMessage?: string }) {
    const prompt = String(userMessage ?? '').trim();
    if (!prompt) {
      throw new Error('Message is required');
    }

    await this.aiSessionService.markSessionStatus(sessionId, 'active');
    await this.aiSessionService.appendMessage(sessionId, 'user', { text: prompt });
    this.aiStreamService.emit(sessionId, 'ai.message', {
      role: 'user',
      text: prompt
    });

    try {
      const resultState = await this.runWithLangGraph({
        projectId,
        sessionId,
        mode: normalizeMode(mode),
        userMessage: prompt,
        haltedForQuestion: false
      });

      if (resultState.haltedForQuestion) {
        await this.aiSessionService.markSessionStatus(sessionId, 'waiting_user');
        await this.aiSessionService.appendMessage(sessionId, 'assistant', {
          text: resultState.question.prompt,
          type: 'question'
        });

        return {
          status: 'waiting_user',
          question: resultState.question,
          mode: resultState.mode
        };
      }

      await this.aiSessionService.markSessionStatus(sessionId, 'completed');
      await this.aiSessionService.appendMessage(sessionId, 'assistant', {
        text: 'DSL updated successfully.',
        type: 'commit',
        version: resultState.updatedProject?.currentVersion ?? null
      });
      this.aiStreamService.emit(sessionId, 'run.completed', {
        status: 'completed'
      });

      return {
        status: 'completed',
        project: resultState.updatedProject,
        mode: resultState.mode
      };
    } catch (error) {
      const message = getErrorMessage(error);
      await this.aiSessionService.markSessionStatus(sessionId, 'failed', message);
      this.aiStreamService.emit(sessionId, 'run.failed', {
        message
      });
      throw error;
    }
  }

  async continueFromDecision({
    projectId,
    sessionId,
    questionId,
    selectedOption,
    rationale = ''
  }: {
    projectId: string;
    sessionId: string;
    questionId: string;
    selectedOption: string;
    rationale?: string;
  }) {
    const resolvedQuestion = await this.aiSessionService.resolveQuestion(sessionId, questionId, {
      actor: 'user',
      selectedOption,
      rationale
    });

    this.aiStreamService.emit(sessionId, 'ai.question.resolved', {
      questionId,
      selectedOption: resolvedQuestion.decision
    });

    return this.runTurn({
      projectId,
      sessionId,
      mode: 'navigator',
      userMessage: `Apply selected option: ${resolvedQuestion.decision}`
    });
  }

  async runWithLangGraph(initialState: OrchestratorState): Promise<OrchestratorState> {
    try {
      const langgraph = await import('@langchain/langgraph');
      const { Annotation, END, START, StateGraph } = langgraph;
      const GraphState = Annotation.Root({
        projectId: Annotation(),
        sessionId: Annotation(),
        mode: Annotation(),
        userMessage: Annotation(),
        currentDsl: Annotation(),
        draftDsl: Annotation(),
        needsDecision: Annotation(),
        question: Annotation(),
        haltedForQuestion: Annotation(),
        updatedProject: Annotation()
      });

      const graph = new StateGraph(GraphState)
        .addNode('load_context', (state) => this.loadContextNode(state as OrchestratorState))
        .addNode('draft_dsl', (state) => this.draftDslNode(state as OrchestratorState))
        .addNode('detect_ambiguity', (state) => this.detectAmbiguityNode(state as OrchestratorState))
        .addNode('resolve_or_ask', (state) => this.resolveOrAskNode(state as OrchestratorState))
        .addNode('validate_repair', (state) => this.validateRepairNode(state as OrchestratorState))
        .addNode('commit_version', (state) => this.commitVersionNode(state as OrchestratorState))
        .addEdge(START, 'load_context')
        .addEdge('load_context', 'draft_dsl')
        .addEdge('draft_dsl', 'detect_ambiguity')
        .addEdge('detect_ambiguity', 'resolve_or_ask')
        .addEdge('resolve_or_ask', 'validate_repair')
        .addEdge('validate_repair', 'commit_version')
        .addEdge('commit_version', END)
        .compile();

      return (await graph.invoke({
        ...initialState,
        haltedForQuestion: false
      })) as OrchestratorState;
    } catch (error) {
      // Fallback keeps service functional if graph runtime setup changes.
      return this.runSequential(initialState, error);
    }
  }

  async runSequential(initialState: OrchestratorState, rootError?: unknown): Promise<OrchestratorState> {
    if (rootError) {
      this.aiStreamService.emit(initialState.sessionId, 'ai.message', {
        role: 'system',
        text: 'LangGraph runtime fallback activated.'
      });
    }

    let state = {
      ...initialState,
      haltedForQuestion: false
    };

    state = await this.loadContextNode(state);
    state = await this.draftDslNode(state);
    state = await this.detectAmbiguityNode(state);
    state = await this.resolveOrAskNode(state);
    state = await this.validateRepairNode(state);
    state = await this.commitVersionNode(state);

    return state;
  }

  async loadContextNode(state: OrchestratorState): Promise<OrchestratorState> {
    const project = await this.projectService.getProject(state.projectId);
    const nextState = {
      ...state,
      mode: normalizeMode(state.mode),
      currentDsl: project.dsl,
      updatedProject: null
    };

    await this.aiSessionService.addCheckpoint(state.sessionId, 'load_context', {
      mode: nextState.mode,
      currentVersion: project.currentVersion?.versionNumber ?? null
    });

    return nextState;
  }

  async draftDslNode(state: OrchestratorState): Promise<OrchestratorState> {
    const dsl = await this.aiProviderService.generateDsl({
      prompt: state.userMessage,
      currentDsl: state.currentDsl
    });

    this.aiStreamService.emit(state.sessionId, 'ai.dsl.preview', {
      nodeCount: dsl.nodes.length
    });

    await this.aiSessionService.addCheckpoint(state.sessionId, 'draft_dsl', {
      nodeCount: dsl.nodes.length
    });

    return {
      ...state,
      draftDsl: dsl
    };
  }

  async detectAmbiguityNode(state: OrchestratorState): Promise<OrchestratorState> {
    const question = detectQuestionFromPrompt(state.userMessage);

    await this.aiSessionService.addCheckpoint(state.sessionId, 'detect_ambiguity', {
      needsDecision: Boolean(question)
    });

    return {
      ...state,
      needsDecision: Boolean(question),
      question
    };
  }

  async resolveOrAskNode(state: OrchestratorState): Promise<OrchestratorState> {
    if (!state.needsDecision || !state.question) {
      return state;
    }

    if (state.mode === 'navigator') {
      const question = await this.aiSessionService.createQuestion(state.sessionId, state.question);
      this.aiStreamService.emit(state.sessionId, 'ai.question.required', question);

      await this.aiSessionService.addCheckpoint(state.sessionId, 'resolve_or_ask', {
        haltedForQuestion: true,
        questionId: question.id
      });

      return {
        ...state,
        haltedForQuestion: true,
        question
      };
    }

    const selectedOption = state.question.options?.[0] ?? 'default';
    const question = await this.aiSessionService.createQuestion(state.sessionId, state.question);
    await this.aiSessionService.resolveQuestion(state.sessionId, question.id, {
      actor: 'model',
      selectedOption,
      rationale: 'Autopilot selected default first option.'
    });

    this.aiStreamService.emit(state.sessionId, 'ai.question.resolved', {
      questionId: question.id,
      selectedOption
    });

    await this.aiSessionService.addCheckpoint(state.sessionId, 'resolve_or_ask', {
      haltedForQuestion: false,
      questionId: question.id,
      selectedOption
    });

    return state;
  }

  async validateRepairNode(state: OrchestratorState): Promise<OrchestratorState> {
    if (state.haltedForQuestion) {
      return state;
    }

    const normalized = normalizeDsl(state.draftDsl ?? state.currentDsl);
    await this.aiSessionService.addCheckpoint(state.sessionId, 'validate_repair', {
      nodeCount: normalized.nodes.length
    });

    return {
      ...state,
      draftDsl: normalized as NormalizedDsl
    };
  }

  async commitVersionNode(state: OrchestratorState): Promise<OrchestratorState> {
    if (state.haltedForQuestion) {
      return state;
    }

    const updatedProject = await this.projectService.saveDsl(state.projectId, state.draftDsl, {
      source: state.mode === 'autopilot' ? 'ai-autopilot' : 'ai-navigator'
    });

    this.aiStreamService.emit(state.sessionId, 'ai.dsl.committed', {
      version: updatedProject.currentVersion
    });

    await this.aiSessionService.addCheckpoint(state.sessionId, 'commit_version', {
      committedVersion: updatedProject.currentVersion?.versionNumber ?? null
    });

    return {
      ...state,
      updatedProject
    };
  }
}

function normalizeMode(mode: string | undefined): 'navigator' | 'autopilot' {
  return String(mode ?? 'navigator').trim().toLowerCase() === 'autopilot'
    ? 'autopilot'
    : 'navigator';
}

function detectQuestionFromPrompt(prompt: string | undefined): AmbiguityQuestion | null {
  const text = String(prompt ?? '').toLowerCase();

  if (!text) {
    return null;
  }

  const hasChoiceKeyword = /( or | choose | style | material | color |尺寸|材质|风格|还是|或者)/.test(
    text
  );

  if (!hasChoiceKeyword) {
    return null;
  }

  return {
    prompt: 'I found ambiguous choices. Which option should be prioritized? ',
    options: ['visual style first', 'accuracy first', 'balanced']
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
