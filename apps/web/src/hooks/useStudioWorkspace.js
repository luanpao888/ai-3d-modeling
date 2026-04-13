import { useEffect, useMemo, useRef, useState } from 'react';

import { useI18n } from '../i18n/I18nProvider.jsx';
import { exportDslToGlb, mountScenePreview } from '../lib/renderDsl.js';
import { createApiClient } from '../services/apiClient.js';

const api = createApiClient();
const HISTORY_PAGE_SIZE = 3;

export function useStudioWorkspace() {
  const { locale, setLocale, languages, t } = useI18n();
  const bootstrappedRef = useRef(false);
  const eventSourceRef = useRef(null);
  const previewRef = useRef(null);
  const previewShellRef = useRef(null);

  const [projectName, setProjectName] = useState(() => t('defaults.projectName'));
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [versions, setVersions] = useState([]);
  const [dslText, setDslText] = useState('');
  const [dslDraft, setDslDraft] = useState('');
  const [dslTab, setDslTab] = useState('viewer');
  const [prompt, setPrompt] = useState(() => t('defaults.aiPrompt'));
  const [senderResetKey, setSenderResetKey] = useState(0);
  const [sessionMode, setSessionMode] = useState('navigator');
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState({ messages: [], questions: [], decisions: [] });
  const [historyOffset, setHistoryOffset] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingOlderHistory, setIsLoadingOlderHistory] = useState(false);
  const [events, setEvents] = useState([]);
  const [assets, setAssets] = useState([]);
  const [status, setStatus] = useState({ key: 'status.bootingWorkspace' });
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [dslModalOpen, setDslModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const transportMode = 'HTTP / SSE';
  const assetIndex = useMemo(
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
  }, [dslText, activeProject, assetIndex]);

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
      if (projectList.length === 0) {
        const created = await api.createProject({
          name: t('defaults.projectName'),
          description: t('defaults.projectDescription')
        });
        await syncProjects(created.id, true);
        setStatus({ key: 'status.starterProjectCreated' });
        return;
      }

      await syncProjects(projectList[0].id, true);
      setStatus({ key: 'status.loadedProjects', values: { count: projectList.length } });
    } catch (issue) {
      setError(issue.message);
      setStatus({ key: 'status.backendConnectionFailed' });
    }
  }

  async function syncProjects(selectedId, shouldOpen = false) {
    const projectList = await api.listProjects();
    setProjects(projectList);

    if (selectedId && shouldOpen) {
      const match = projectList.find((project) => project.id === selectedId);
      if (match && (!activeProject || activeProject.id !== selectedId)) {
        await loadWorkspace(selectedId);
      }
    }
  }

  async function loadWorkspace(projectId) {
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

  function openProjectData(project, nextVersions = versions, nextSession = session, nextHistory = history) {
    const nextDslText = JSON.stringify(project.dsl, null, 2);
    setActiveProject(project);
    setVersions(nextVersions);
    setSession(nextSession);
    setHistory(nextHistory);
    setDslText(nextDslText);
    setDslDraft(nextDslText);
    setError('');
  }

  async function handleOpenProject(projectId) {
    try {
      await loadWorkspace(projectId);
      setStatus({
        key: 'status.openedProject',
        values: { name: projects.find((item) => item.id === projectId)?.name ?? projectId }
      });
    } catch (issue) {
      setError(issue.message);
    }
  }

  async function handleCreateProject() {
    try {
      const nextProjectName = projectName.trim() || t('defaults.projectName');
      const created = await api.createProject({
        name: nextProjectName,
        description: t('defaults.createdFromWeb')
      });
      await syncProjects(created.id, true);
      setProjectName(nextProjectName);
      setStatus({ key: 'status.createdProject', values: { name: created.name } });
    } catch (issue) {
      setError(issue.message);
    }
  }

  async function handleSaveDslFromModal(newDslText) {
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
      setError(issue.message);
    }
  }

  async function handleGenerateDsl(nextPrompt) {
    const outboundPrompt = String(nextPrompt ?? prompt).trim();
    if (!activeProject || !session || !outboundPrompt) {
      return;
    }

    try {
      setIsRunning(true);
      setStatus({ key: 'status.generatingDsl' });
      const result = await api.sendSessionMessage(activeProject.id, session.id, outboundPrompt);
      setPrompt('');
      setSenderResetKey((current) => current + 1);
      await refreshProjectState(activeProject.id, session.id);

      if (result.status === 'waiting_user') {
        setStatus({ key: 'status.waitingUser' });
      } else {
        setStatus({ key: 'status.sessionCompleted' });
      }
    } catch (issue) {
      setError(issue.message);
      setStatus({ key: 'status.sessionFailed' });
    } finally {
      setIsRunning(false);
    }
  }

  async function handleResolveQuestion(questionId, selectedOption) {
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
      setError(issue.message);
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
      setHistory(nextHistory);
      setHistoryOffset(nextHistory.messages?.length ?? 0);
      setHasMoreHistory(Boolean(nextHistory.hasMoreMessages));
      setEvents([]);
      connectEventStream(activeProject.id, nextSession.id);
      setStatus({ key: 'status.sessionReady', values: { mode: t(`modes.${nextSession.mode}`) } });
    } catch (issue) {
      setError(issue.message);
    }
  }

  async function refreshProjectState(projectId, sessionId) {
    const desiredLimit = Math.max(historyOffset, HISTORY_PAGE_SIZE);
    const [project, projectVersions, nextHistory, nextSession] = await Promise.all([
      api.getProject(projectId),
      api.listVersions(projectId),
      api.listSessionHistory(projectId, sessionId, { limit: desiredLimit, offset: 0 }),
      api.getSession(projectId, sessionId)
    ]);

    openProjectData(project, projectVersions, nextSession, nextHistory);
    setHistoryOffset(nextHistory.messages?.length ?? 0);
    setHasMoreHistory(Boolean(nextHistory.hasMoreMessages));
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
      setError(issue.message);
    } finally {
      setIsLoadingOlderHistory(false);
    }
  }

  function connectEventStream(projectId, sessionId) {
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
        const payload = safeParseDsl(event.data) ?? {};
        setEvents((current) => [
          {
            id: `${eventName}-${event.lastEventId || Date.now()}`,
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
      setError(issue.message);
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
      setError(issue.message);
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
      setError(issue.message);
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
    projectName,
    setProjectName,
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
    sidebarCollapsed,
    setSidebarCollapsed,
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
    handleSaveDslFromModal
  };
}

function mergeUniqueMessages(olderMessages, currentMessages) {
  const seen = new Set();
  const merged = [];

  for (const message of [...olderMessages, ...currentMessages]) {
    if (!message || seen.has(message.id)) {
      continue;
    }

    seen.add(message.id);
    merged.push(message);
  }

  return merged;
}

function safeParseDsl(input) {
  if (!input) {
    return null;
  }

  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function renderStatus(t, status) {
  if (!status) {
    return '';
  }

  if (typeof status === 'string') {
    return status;
  }

  return t(status.key, status.values);
}

function getDslError(input) {
  if (!input) {
    return null;
  }

  try {
    JSON.parse(input);
    return null;
  } catch (error) {
    return error.message;
  }
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
