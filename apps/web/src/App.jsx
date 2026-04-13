import { useEffect, useMemo, useRef, useState } from 'react';

import {
  App as AntApp,
  Badge,
  Button,
  Card,
  ConfigProvider,
  Empty,
  Flex,
  Input,
  Layout,
  List,
  Modal,
  Segmented,
  Select,
  Space,
  Tabs,
  Tag,
  Timeline,
  Typography
} from 'antd';
import {
  AppstoreOutlined,
  ArrowsAltOutlined,
  CodeOutlined,
  ExportOutlined,
  FolderOpenOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined
} from '@ant-design/icons';
import { Bubble, Conversations, Sender, XProvider } from '@ant-design/x';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';

import { useI18n } from './i18n/I18nProvider.jsx';
import { exportDslToGlb, mountScenePreview } from './lib/renderDsl.js';
import { createApiClient } from './services/apiClient.js';

const api = createApiClient();
const MODE_OPTIONS = ['navigator', 'autopilot'];
const { Sider, Content } = Layout;
const { Text, Title } = Typography;

export default function App() {
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
  const [sessionMode, setSessionMode] = useState('navigator');
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState({ messages: [], questions: [], decisions: [] });
  const [events, setEvents] = useState([]);
  const [assets, setAssets] = useState([]);
  const [status, setStatus] = useState({ key: 'status.bootingWorkspace' });
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [dslModalOpen, setDslModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const assetIndex = useMemo(
    () => Object.fromEntries(assets.map((asset) => [asset.id, asset])),
    [assets]
  );

  const transportMode = 'HTTP / SSE';

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
    const nextHistory = await api.listSessionHistory(projectId, nextSession.id);

    openProjectData(project, projectVersions, nextSession, nextHistory);
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

  async function handleGenerateDsl() {
    if (!activeProject || !session || !prompt.trim()) {
      return;
    }

    try {
      setIsRunning(true);
      setStatus({ key: 'status.generatingDsl' });
      const result = await api.sendSessionMessage(activeProject.id, session.id, prompt);
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
      const nextHistory = await api.listSessionHistory(activeProject.id, nextSession.id);
      setSession(nextSession);
      setHistory(nextHistory);
      setEvents([]);
      connectEventStream(activeProject.id, nextSession.id);
      setStatus({ key: 'status.sessionReady', values: { mode: t(`modes.${nextSession.mode}`) } });
    } catch (issue) {
      setError(issue.message);
    }
  }

  async function refreshProjectState(projectId, sessionId) {
    const [project, projectVersions, nextHistory, nextSession] = await Promise.all([
      api.getProject(projectId),
      api.listVersions(projectId),
      api.listSessionHistory(projectId, sessionId),
      api.getSession(projectId, sessionId)
    ]);

    openProjectData(project, projectVersions, nextSession, nextHistory);
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

  const projectConversationItems = useMemo(
    () =>
      projects.map((project) => ({
        key: project.id,
        label: (
          <div className="studio-project-row">
            <div className="studio-project-row__top">
              <Text className="studio-project-name">{project.name}</Text>
              <Tag bordered={false} className="studio-version-tag">
                v{project.currentVersion?.versionNumber ?? 1}
              </Tag>
            </div>
            <Text className="studio-project-id">{project.id}</Text>
          </div>
        ),
        icon: <FolderOpenOutlined />
      })),
    [projects]
  );

  const mergedTimelineItems = useMemo(() => {
    const records = [];

    for (const message of history.messages ?? []) {
      records.push({
        key: `message-${message.id}`,
        role: message.role === 'assistant' ? 'ai' : 'user',
        order: Date.parse(message.createdAt || '') || 0,
        content: message.content?.text ?? JSON.stringify(message.content, null, 2)
      });
    }

    for (const question of history.questions ?? []) {
      records.push({
        key: `question-${question.id}`,
        role: 'ai',
        order: Date.parse(question.createdAt || '') || 0,
        content: (
          <div className="studio-question-block">
            <Text strong>{question.prompt}</Text>
            <Space wrap>
              {(question.options ?? []).map((option) => (
                <Button
                  key={option}
                  size="small"
                  className="studio-option-button"
                  onClick={() => handleResolveQuestion(question.id, option)}
                  disabled={question.status !== 'pending' || isRunning}
                >
                  {option}
                </Button>
              ))}
            </Space>
            <Text type="secondary">
              {question.status === 'pending' ? t('status.waitingUser') : t('labels.resolved')}
            </Text>
          </div>
        )
      });
    }

    for (const decision of history.decisions ?? []) {
      records.push({
        key: `decision-${decision.id}`,
        role: 'system',
        order: Date.parse(decision.createdAt || '') || 0,
        content: (
          <div className="studio-system-block">
            <Text strong>{t('labels.decision')}</Text>
            <Text>{decision.selectedOption}</Text>
            {decision.rationale ? <Text type="secondary">{decision.rationale}</Text> : null}
          </div>
        )
      });
    }

    const eventBase = Date.now();
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      records.push({
        key: event.id,
        role: 'system',
        order: eventBase + index,
        content: (
          <div className="studio-system-block">
            <Text strong>{event.event}</Text>
            <pre className="studio-event-pre">{JSON.stringify(event.payload, null, 2)}</pre>
          </div>
        )
      });
    }

    records.sort((left, right) => left.order - right.order);
    return records;
  }, [events, history.decisions, history.messages, history.questions, isRunning, t]);

  const roleConfig = useMemo(
    () => ({
      user: {
        placement: 'end',
        variant: 'shadow',
        avatar: <div className="studio-bubble-avatar studio-bubble-avatar--user"><UserOutlined /></div>
      },
      ai: {
        placement: 'start',
        variant: 'shadow',
        avatar: <div className="studio-bubble-avatar studio-bubble-avatar--ai"><RobotOutlined /></div>
      },
      system: {
        placement: 'start',
        variant: 'outlined',
        avatar: <div className="studio-bubble-avatar studio-bubble-avatar--system"><AppstoreOutlined /></div>
      }
    }),
    []
  );

  const dslObject = safeParseDsl(dslDraft) ?? safeParseDsl(dslText) ?? activeProject?.dsl ?? {};
  const dslDraftError = getDslError(dslDraft);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorBgBase: '#ffffff',
          colorText: '#171717',
          colorTextSecondary: '#666666',
          colorPrimary: '#0a72ef',
          colorBorder: 'rgba(0,0,0,0.08)',
          colorSplit: '#ebebeb',
          borderRadius: 8,
          fontFamily: "Geist, 'Helvetica Neue', Arial, sans-serif",
          boxShadow:
            'rgba(0,0,0,0.08) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 2px, rgba(0,0,0,0.04) 0 8px 8px -8px, #fafafa 0 0 0 1px'
        },
        components: {
          Layout: {
            siderBg: 'rgba(255,255,255,0.92)',
            headerBg: '#ffffff',
            bodyBg: '#ffffff',
            triggerBg: '#ffffff'
          },
          Card: { bodyPadding: 16, headerBg: '#ffffff' },
          Button: {
            borderRadius: 6,
            controlHeight: 38,
            defaultShadow: 'rgb(235,235,235) 0 0 0 1px',
            primaryShadow: 'rgb(23,23,23) 0 0 0 1px'
          },
          Modal: { contentBg: '#ffffff', headerBg: '#ffffff' }
        }
      }}
    >
      <AntApp>
        <XProvider>
          <Layout className="studio-root">
            <Sider
              className="studio-sider"
              width={320}
              collapsedWidth={72}
              collapsed={sidebarCollapsed}
              trigger={null}
            >
              <div className="studio-sider-top">
                <Button
                  type="text"
                  className="studio-collapse-button"
                  icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={() => setSidebarCollapsed((value) => !value)}
                />
                {!sidebarCollapsed ? (
                  <div className="studio-brand-copy">
                    <Text className="studio-eyebrow">Project agent workspace</Text>
                    <Title level={3}>{t('app.title')}</Title>
                    <Text>{t('app.tagline')}</Text>
                  </div>
                ) : null}
              </div>

              {!sidebarCollapsed ? (
                <div className="studio-sider-scroll">
                  <Card className="studio-card" bordered={false}>
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Text className="studio-eyebrow">{t('sidebar.newProject')}</Text>
                      <Input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
                      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateProject}>
                        {t('actions.createProject')}
                      </Button>
                    </Space>
                  </Card>

                  <Card
                    className="studio-card"
                    bordered={false}
                    title={t('sidebar.projects')}
                    extra={<Badge count={projects.length} style={{ background: '#ebf5ff', color: '#0068d6' }} />}
                  >
                    <Conversations
                      items={projectConversationItems}
                      activeKey={activeProject?.id}
                      onActiveChange={handleOpenProject}
                      className="studio-conversations"
                    />
                  </Card>

                  <Card className="studio-card" bordered={false} title={t('sidebar.versions')}>
                    <Timeline
                      items={versions.map((version) => ({
                        color: '#0a72ef',
                        children: (
                          <div className="studio-timeline-entry">
                            <Text strong>v{version.versionNumber}</Text>
                            <Text type="secondary">{version.source}</Text>
                          </div>
                        )
                      }))}
                    />
                  </Card>

                  <Card
                    className="studio-card"
                    bordered={false}
                    title={t('sidebar.assetRegistry')}
                    extra={<Badge count={assets.length} style={{ background: '#ebebeb', color: '#171717' }} />}
                  >
                    <List
                      dataSource={assets}
                      renderItem={(asset) => (
                        <List.Item className="studio-asset-row">
                          <List.Item.Meta
                            avatar={<AppstoreOutlined className="studio-asset-icon" />}
                            title={<Text>{asset.name}</Text>}
                            description={<Text type="secondary">{asset.id}</Text>}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </div>
              ) : (
                <div className="studio-sider-collapsed-icons">
                  <Button type="text" icon={<FolderOpenOutlined />} />
                  <Button type="text" icon={<CodeOutlined />} />
                  <Button type="text" icon={<RobotOutlined />} />
                </div>
              )}
            </Sider>

            <Content className="studio-content">
              <Card className="studio-card studio-toolbar" bordered={false}>
                <Flex justify="space-between" align="center" gap={16} wrap>
                  <div>
                    <Text className="studio-eyebrow">Current workspace</Text>
                    <Title level={3} className="studio-toolbar-title">
                      {activeProject?.name ?? t('toolbar.noProjectSelected')}
                    </Title>
                    <Text type="secondary">{renderStatus(t, status)}</Text>
                  </div>

                  <Space size={12} wrap align="center">
                    <Select
                      value={locale}
                      style={{ width: 120 }}
                      onChange={setLocale}
                      options={languages.map((item) => ({ value: item.code, label: item.label }))}
                    />
                    <Segmented
                      value={sessionMode}
                      onChange={(value) => setSessionMode(value)}
                      options={MODE_OPTIONS.map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))}
                    />
                    <Tag className="studio-pill-tag">{transportMode}</Tag>
                    <Tag className="studio-pill-tag">{t('toolbar.unitsValue')}</Tag>
                    {session ? <Tag className="studio-pill-tag">session {session.id}</Tag> : null}
                    <Button onClick={handleCreateSession}>{t('actions.createSession')}</Button>
                  </Space>
                </Flex>
              </Card>

              {error ? (
                <Card className="studio-error-card" bordered={false}>
                  <Text>{error}</Text>
                </Card>
              ) : null}

              <div className="studio-workspace">
                <Card className="studio-card studio-preview-card" bordered={false}>
                  <Flex justify="space-between" align="center" className="studio-preview-meta">
                    <div>
                      <Text className="studio-eyebrow">{t('labels.preview')}</Text>
                      <Text type="secondary">
                        {t('labels.currentVersion')}: v{activeProject?.currentVersion?.versionNumber ?? 1}
                      </Text>
                    </div>
                    <Space wrap>
                      <Button icon={<CodeOutlined />} onClick={openDslModal}>
                        {t('actions.editDsl')}
                      </Button>
                      <Button icon={<ArrowsAltOutlined />} onClick={handleToggleFullscreen}>
                        {isFullscreen ? t('actions.exitFullscreen') : t('actions.fullscreen')}
                      </Button>
                      <Button icon={<ExportOutlined />} onClick={handleDownloadZip} disabled={!activeProject}>
                        {t('actions.exportZip')}
                      </Button>
                      <Button icon={<ExportOutlined />} onClick={handleExportGlb} disabled={!activeProject}>
                        {t('actions.exportGlb')}
                      </Button>
                    </Space>
                  </Flex>

                  <div className="studio-preview-shell" ref={previewShellRef}>
                    <div className="studio-preview-canvas" ref={previewRef} />
                  </div>
                </Card>

                <Card className="studio-card studio-chat-card" bordered={false}>
                  <Flex justify="space-between" align="center" className="studio-chat-head">
                    <div>
                      <Text className="studio-eyebrow">{t('labels.chatTitle')}</Text>
                      <Title level={4} className="studio-chat-title">
                        {session ? t(`modes.${session.mode}`) : t('actions.createSession')}
                      </Title>
                    </div>
                    <Tag className="studio-pill-tag">{mergedTimelineItems.length}</Tag>
                  </Flex>

                  {mergedTimelineItems.length ? (
                    <Bubble.List
                      className="studio-bubble-list"
                      items={mergedTimelineItems}
                      role={roleConfig}
                      autoScroll
                    />
                  ) : (
                    <div className="studio-empty-chat">
                      <Empty description={t('labels.noMessages')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    </div>
                  )}

                  <div className="studio-sender-wrap">
                    <Sender
                      value={prompt}
                      loading={isRunning}
                      submitType="enter"
                      onChange={(value) => setPrompt(value)}
                      onSubmit={handleGenerateDsl}
                      placeholder={t('labels.aiPrompt')}
                      autoSize={{ minRows: 3, maxRows: 6 }}
                      prefix={<Tag className="studio-pill-tag studio-mode-tag">{t(`modes.${sessionMode}`)}</Tag>}
                      footer={
                        <Flex justify="space-between" align="center" className="studio-sender-footer">
                          <Text type="secondary">{t('labels.ctrlEnter')}</Text>
                          <Button type="primary" icon={<SendOutlined />} onClick={handleGenerateDsl} loading={isRunning}>
                            {t('actions.sendMessage')}
                          </Button>
                        </Flex>
                      }
                    />
                  </div>
                </Card>
              </div>
            </Content>
          </Layout>

          <Modal
            open={dslModalOpen}
            onCancel={() => setDslModalOpen(false)}
            title={t('labels.sceneDsl')}
            width={920}
            className="studio-dsl-modal"
            footer={[
              <Button
                key="format"
                onClick={() => {
                  try {
                    setDslDraft(JSON.stringify(JSON.parse(dslDraft || dslText), null, 2));
                  } catch {
                    return;
                  }
                }}
              >
                {t('actions.formatJson')}
              </Button>,
              <Button key="cancel" onClick={() => setDslModalOpen(false)}>
                {t('actions.cancel')}
              </Button>,
              <Button
                key="save"
                type="primary"
                disabled={Boolean(dslDraftError)}
                onClick={() => handleSaveDslFromModal(dslDraft)}
              >
                {t('actions.saveDsl')}
              </Button>
            ]}
          >
            <Tabs
              activeKey={dslTab}
              onChange={setDslTab}
              items={[
                {
                  key: 'viewer',
                  label: t('labels.dslViewer'),
                  children: (
                    <div className="studio-json-view-shell">
                      <JsonView src={dslObject} theme="github" collapsed={2} displaySize="expanded" />
                    </div>
                  )
                },
                {
                  key: 'editor',
                  label: t('labels.dslEditor'),
                  children: (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      {dslDraftError ? <Tag color="error">{dslDraftError}</Tag> : <Tag color="success">{t('labels.jsonValid')}</Tag>}
                      <Input.TextArea
                        value={dslDraft}
                        onChange={(event) => setDslDraft(event.target.value)}
                        autoSize={{ minRows: 20, maxRows: 28 }}
                        className="studio-dsl-editor"
                      />
                    </Space>
                  )
                }
              ]}
            />
          </Modal>
        </XProvider>
      </AntApp>
    </ConfigProvider>
  );
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