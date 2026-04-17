import { useEffect, useMemo, useRef, useState } from 'react';

import { useI18n } from '../i18n/I18nProvider';
import { exportDslToGlb, mountScenePreview } from '../lib/renderDsl';
import {
  createApiClient,
  type AssetRecord,
  type DecisionRecord,
  type MessageRecord,
  type ProjectRecord,
  type QuestionRecord,
  type SessionHistoryRecord,
  type SessionRecord,
  type VersionRecord
} from '../services/apiClient';

const api = createApiClient();
const HISTORY_PAGE_SIZE = 3;

interface HistoryState extends SessionHistoryRecord {
  messages: MessageRecord[];
  questions: QuestionRecord[];
  decisions: DecisionRecord[];
}

interface StatusState {
  key: string;
  values?: Record<string, string | number>;
}

export function useStudioWorkspace() {
  const { locale, setLocale, languages, t } = useI18n();
  const bootstrappedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewShellRef = useRef<HTMLDivElement | null>(null);

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectRecord | null>(null);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [dslText, setDslText] = useState('');
  const [dslDraft, setDslDraft] = useState('');
  const [dslTab, setDslTab] = useState('viewer');
  const [prompt, setPrompt] = useState(() => t('defaults.aiPrompt'));
  const [senderResetKey, setSenderResetKey] = useState(0);
  const [sessionMode, setSessionMode] = useState('navigator');
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [history, setHistory] = useState<HistoryState>({ messages: [], questions: [], decisions: [] });
  const [historyOffset, setHistoryOffset] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingOlderHistory, setIsLoadingOlderHistory] = useState(false);
  const [events, setEvents] = useState<Array<{ id: string; event: string; payload: unknown }>>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [status, setStatus] = useState<StatusState>({ key: 'status.bootingWorkspace' });
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [dslModalOpen, setDslModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const transportMode = 'HTTP / SSE';
  const assetIndex = useMemo<Record<string, AssetRecord>>(
    () => Object.fromEntries(assets.map((asset) => [asset.id, asset])),
    [assets]
  );

  useEffect(() => {
    document.title = t('app.title');
  }, [t]);

  useEffect(() => {
    if (bootstrappedRef.current) {
      return;
    }

    bootstrappedRef.current = true;
    void bootstrap();
  }, []);

  useEffect(() => {
    const parsedDsl = safeParseDsl(dslText) ?? activeProject?.dsl;
    const cleanup = mountScenePreview(previewRef.current, parsedDsl, assetIndex);
    return () => cleanup?.();
  }, [dslText, activeProject, assetIndex, previewKey]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  async function bootstrap() {
    try {
      const registryAssets = await api.searchAssets('');
      setAssets(registryAssets);

      const projectList = await api.listProjects();
      setProjects(projectList);

      if (projectList.length > 0) {
        setStatus({ key: 'status.loadedProjects', values: { count: projectList.length } });
      } else {
        setStatus({ key: 'status.bootingWorkspace' });
      }
    } catch (issue) {
      setError(getErrorMessage(issue));
      setStatus({ key: 'status.backendConnectionFailed' });
    }
  }

  async function syncProjects(selectedId?: string, shouldOpen = false) {
    const projectList = await api.listProjects();
    setProjects(projectList);

    if (selectedId && shouldOpen) {
      const match = projectList.find((project) => project.id === selectedId);
      if (match && (!activeProject || activeProject.id !== selectedId)) {
        await loadWorkspace(selectedId);
      }
    }
  }

  async function loadWorkspace(projectId: string) {
    const [project, projectVersions] = await Promise.all([
      api.getProject(projectId),
      api.listVersions(projectId)
    ]);

    const nextSession = await api.createSession(projectId, sessionMode);
    const nextHistory = await api.listSessionHistory(projectId, nextSession.id, {
      limit: HISTORY_PAGE_SIZE,
      offset: 0
    });

    openProjectData(project, projectVersions, nextSession, nextHistory);
    setHistoryOffset(nextHistory.messages?.length ?? 0);
    setHasMoreHistory(Boolean(nextHistory.hasMoreMessages));
    setEvents([]);
    connectEventStream(projectId, nextSession.id);
  }

  function openProjectData(
    project: ProjectRecord,
    nextVersions: VersionRecord[] = versions,
    nextSession: SessionRecord | null = session,
    nextHistory: SessionHistoryRecord = history
  ) {
    const nextDslText = JSON.stringify(project.dsl, null, 2);
    setActiveProject(project);
    setVersions(nextVersions);
    setSession(nextSession);
    setHistory({
      messages: nextHistory.messages ?? [],
      questions: nextHistory.questions ?? [],
      decisions: nextHistory.decisions ?? []
    });
    setDslText(nextDslText);
    setDslDraft(nextDslText);
    setError('');
  }

  async function handleOpenProject(projectId: string) {
    try {
      await loadWorkspace(projectId);
      setStatus({
        key: 'status.openedProject',
        values: { name: projects.find((item) => item.id === projectId)?.name ?? projectId }
      });
    } catch (issue) {
      setError(getErrorMessage(issue));
    }
  }

  async function handleCreateProject(data: Record<string, unknown>) {
    try {
      const created = await api.createProject({
        description: t('defaults.createdFromWeb'),
        ...data
      });
      await syncProjects(created.id, true);
      setStatus({ key: 'status.createdProject', values: { name: created.name as string } });
    } catch (issue) {
      setError(getErrorMessage(issue));
      throw issue;
    }
  }

  async function handleSaveDslFromModal(newDslText: string) {
    if (!activeProject) {
      return;
    }

    try {
      const parsedDsl = JSON.parse(newDslText);
      const saved = await api.saveDsl(activeProject.id, parsedDsl);
      const nextVersions = await api.listVersions(saved.id);
      setDslText(newDslText);
      setDslDraft(newDslText);
      openProjectData(saved, nextVersions);
      await syncProjects(saved.id, false);
      setDslModalOpen(false);
      setStatus({ key: 'status.dslSaved' });
    } catch (issue) {
      setError(getErrorMessage(issue));
    }
  }

  async function handleGenerateDsl(nextPrompt?: string) {
    const outboundPrompt = String(nextPrompt ?? prompt).trim();
    if (!activeProject || !session || !outboundPrompt) {
      return;
    }

    try {
      setIsRunning(true);
      setStatus({ key: 'status.generatingDsl' });

      // Optimistically show the user message and clear the input immediately
      const optimisticMessage: MessageRecord = {
        id: `optimistic-${Date.now()}`,
        role: 'user',
        content: { text: outboundPrompt },
        createdAt: new Date().toISOString()
      };
      setHistory((current) => ({
        ...current,
        messages: [...(current.messages ?? []), optimisticMessage]
      }));
      setPrompt('');
      setSenderResetKey((current) => current + 1);

      const result = await api.sendSessionMessage(activeProject.id, session.id, outboundPrompt);
      await refreshProjectState(activeProject.id, session.id);

      if (result.status === 'waiting_user') {
        setStatus({ key: 'status.waitingUser' });
      } else {
        setStatus({ key: 'status.sessionCompleted' });
      }
    } catch (issue) {
      setError(getErrorMessage(issue));
      setStatus({ key: 'status.sessionFailed' });
    } finally {
      setIsRunning(false);
    }
  }

  async function handleResolveQuestion(questionId: string, selectedOption: string) {
    if (!activeProject || !session) {
      return;
    }

    try {
      setIsRunning(true);
      const result = await api.resolveQuestion(activeProject.id, session.id, questionId, selectedOption);
      await refreshProjectState(activeProject.id, session.id);
      setStatus({
        key: result.status === 'waiting_user' ? 'status.waitingUser' : 'status.sessionCompleted'
      });
    } catch (issue) {
      setError(getErrorMessage(issue));
      setStatus({ key: 'status.sessionFailed' });
    } finally {
      setIsRunning(false);
    }
  }

  async function handleCreateSession() {
    if (!activeProject) {
      return;
    }

    try {
      const nextSession = await api.createSession(activeProject.id, sessionMode);
      const nextHistory = await api.listSessionHistory(activeProject.id, nextSession.id, {
        limit: HISTORY_PAGE_SIZE,
        offset: 0
      });
      setSession(nextSession);
      setHistory({
        messages: nextHistory.messages ?? [],
        questions: nextHistory.questions ?? [],
        decisions: nextHistory.decisions ?? []
      });
      setHistoryOffset(nextHistory.messages?.length ?? 0);
      setHasMoreHistory(Boolean(nextHistory.hasMoreMessages));
      setEvents([]);
      connectEventStream(activeProject.id, nextSession.id);
      setStatus({ key: 'status.sessionReady', values: { mode: t(`modes.${nextSession.mode}`) } });
    } catch (issue) {
      setError(getErrorMessage(issue));
    }
  }

  async function refreshProjectState(projectId: string, sessionId: string) {
    const [project, projectVersions, newHistory, nextSession] = await Promise.all([
      api.getProject(projectId),
      api.listVersions(projectId),
      api.listSessionHistory(projectId, sessionId, { limit: HISTORY_PAGE_SIZE * 2, offset: historyOffset }),
      api.getSession(projectId, sessionId)
    ]);

    const nextDslText = JSON.stringify(project.dsl, null, 2);
    setActiveProject(project);
    setVersions(projectVersions);
    setSession(nextSession);
    setHistory((current) => ({
      messages: mergeUniqueMessages(
        (current.messages ?? []).filter((m) => !m.id.startsWith('optimistic-')),
        newHistory.messages ?? []
      ),
      questions: newHistory.questions ?? current.questions,
      decisions: newHistory.decisions ?? current.decisions
    }));
    setDslText(nextDslText);
    setDslDraft(nextDslText);
    setError('');
    setHistoryOffset((current) => current + (newHistory.messages?.length ?? 0));
    setHasMoreHistory(Boolean(newHistory.hasMoreMessages));
  }

  async function handleLoadOlderHistory() {
    if (!activeProject || !session || !hasMoreHistory || isLoadingOlderHistory) {
      return;
    }

    try {
      setIsLoadingOlderHistory(true);
      const nextHistory = await api.listSessionHistory(activeProject.id, session.id, {
        limit: HISTORY_PAGE_SIZE,
        offset: historyOffset
      });

      setHistory((current) => ({
        ...current,
        messages: mergeUniqueMessages(nextHistory.messages ?? [], current.messages ?? []),
        questions: nextHistory.questions ?? current.questions,
        decisions: nextHistory.decisions ?? current.decisions
      }));
      setHistoryOffset((current) => current + (nextHistory.messages?.length ?? 0));
      setHasMoreHistory(Boolean(nextHistory.hasMoreMessages));
    } catch (issue) {
      setError(getErrorMessage(issue));
    } finally {
      setIsLoadingOlderHistory(false);
    }
  }

  function connectEventStream(projectId: string, sessionId: string) {
    eventSourceRef.current?.close();

    const eventSource = api.createEventStream(projectId, sessionId);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStatus({ key: 'status.streamConnected' });
    };

    eventSource.onerror = () => {
      setStatus({ key: 'status.streamDisconnected' });
    };

    for (const eventName of [
      'session.started',
      'ai.message',
      'ai.question.required',
      'ai.question.resolved',
      'ai.dsl.preview',
      'ai.dsl.committed',
      'run.completed',
      'run.failed',
      'heartbeat'
    ]) {
      eventSource.addEventListener(eventName, (event) => {
        const payload = safeParseDsl((event as MessageEvent<string>).data) ?? {};
        setEvents((current) => [
          {
            id: `${eventName}-${(event as MessageEvent<string>).lastEventId || Date.now()}`,
            event: eventName,
            payload
          },
          ...current
        ].slice(0, 48));
      });
    }
  }

  async function handleDownloadZip() {
    if (!activeProject) {
      return;
    }

    try {
      const response = await api.downloadProjectZip(activeProject.id);
      const blob = await response.blob();
      triggerDownload(blob, `${activeProject.id}.zip`);
      setStatus({ key: 'status.projectZipExported' });
    } catch (issue) {
      setError(getErrorMessage(issue));
    }
  }

  async function handleExportGlb() {
    if (!activeProject) {
      return;
    }

    try {
      const parsedDsl = safeParseDsl(dslText) ?? activeProject.dsl;
      await exportDslToGlb(parsedDsl, assetIndex, `${activeProject.id}.glb`);
      setStatus({ key: 'status.glbExported' });
    } catch (issue) {
      setError(getErrorMessage(issue));
    }
  }

  async function handleToggleFullscreen() {
    if (!previewShellRef.current) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await previewShellRef.current.requestFullscreen();
    } catch (issue) {
      setError(getErrorMessage(issue));
    }
  }

  function openDslModal() {
    setDslDraft(dslText);
    setDslTab('viewer');
    setDslModalOpen(true);
  }

  const statusText = useMemo(() => renderStatus(t, status), [t, status]);
  const dslObject = useMemo(
    () => safeParseDsl(dslDraft) ?? safeParseDsl(dslText) ?? activeProject?.dsl ?? {},
    [dslDraft, dslText, activeProject]
  );
  const dslDraftError = useMemo(() => getDslError(dslDraft), [dslDraft]);

  return {
    locale,
    setLocale,
    languages,
    t,
    projects,
    activeProject,
    versions,
    history,
    hasMoreHistory,
    isLoadingOlderHistory,
    events,
    assets,
    statusText,
    error,
    isRunning,
    sessionMode,
    setSessionMode,
    session,
    prompt,
    setPrompt,
    senderResetKey,
    dslModalOpen,
    setDslModalOpen,
    dslDraft,
    setDslDraft,
    dslTab,
    setDslTab,
    dslObject,
    dslDraftError,
    transportMode,
    isFullscreen,
    previewRef,
    previewShellRef,
    handleCreateProject,
    handleOpenProject,
    handleGenerateDsl,
    handleResolveQuestion,
    handleLoadOlderHistory,
    handleDownloadZip,
    handleExportGlb,
    handleToggleFullscreen,
    openDslModal,
    handleSaveDslFromModal,
    remountPreview: () => setPreviewKey((k) => k + 1)
  };
}

function mergeUniqueMessages(olderMessages: MessageRecord[], currentMessages: MessageRecord[]) {
  const seen = new Set<string>();
  const merged: MessageRecord[] = [];

  for (const message of [...olderMessages, ...currentMessages]) {
    if (!message || seen.has(message.id)) {
      continue;
    }

    seen.add(message.id);
    merged.push(message);
  }

  return merged;
}

function safeParseDsl(input: string | null | undefined) {
  if (!input) {
    return null;
  }

  try {
    return JSON.parse(input) as unknown;
  } catch {
    return null;
  }
}

function renderStatus(
  t: (key: string, values?: Record<string, string | number>) => string,
  status?: string | StatusState | null
) {
  if (!status) {
    return '';
  }

  if (typeof status === 'string') {
    return status;
  }

  return t(status.key, status.values);
}

function getDslError(input: string) {
  if (!input) {
    return null;
  }

  try {
    JSON.parse(input);
    return null;
  } catch (error) {
    return getErrorMessage(error);
  }
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getErrorMessage(issue: unknown) {
  return issue instanceof Error ? issue.message : String(issue);
}