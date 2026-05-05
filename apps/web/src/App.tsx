import { Card, Layout, Typography } from 'antd';
import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import 'react18-json-view/src/style.css';

import { AppNav } from './components/AppNav';
import { ProjectsPage } from './components/ProjectsPage';
import { StudioChatPanel } from './components/studio/StudioChatPanel';
import { StudioDslModal } from './components/studio/StudioDslModal';
import { StudioPreviewPanel } from './components/studio/StudioPreviewPanel';
import { StudioThemeProvider } from './components/studio/StudioThemeProvider';
import { StudioToolbar } from './components/studio/StudioToolbar';
import { useStudioWorkspace } from './hooks/useStudioWorkspace';
import { createApiClient } from './services/apiClient';

const { Content } = Layout;
const { Text } = Typography;

const api = createApiClient();

function StudioView({
  workspace,
  onNavigateToProjects,
}: {
  workspace: ReturnType<typeof useStudioWorkspace>;
  onNavigateToProjects: () => void;
}) {
  useEffect(() => {
    workspace.remountPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="studio-content">
      <StudioToolbar
        t={workspace.t}
        activeProject={workspace.activeProject}
        statusText={workspace.statusText}
        locale={workspace.locale}
        setLocale={workspace.setLocale}
        languages={workspace.languages}
        sessionMode={workspace.sessionMode}
        setSessionMode={workspace.setSessionMode}
        transportMode={workspace.transportMode}
        session={workspace.session}
      />
      {workspace.error ? (
        <Card className="studio-error-card" bordered={false}>
          <Text>{workspace.error}</Text>
        </Card>
      ) : null}
      <div className="studio-workspace">
        <StudioPreviewPanel
          t={workspace.t}
          activeProject={workspace.activeProject}
          isFullscreen={workspace.isFullscreen}
          isRunning={workspace.isRunning}
          previewShellRef={workspace.previewShellRef}
          previewRef={workspace.previewRef}
          onOpenDsl={workspace.openDslModal}
          onToggleFullscreen={workspace.handleToggleFullscreen}
          onDownloadZip={workspace.handleDownloadZip}
          onExportGlb={workspace.handleExportGlb}
        />
        <StudioChatPanel
          t={workspace.t}
          session={workspace.session}
          prompt={workspace.prompt}
          setPrompt={workspace.setPrompt}
          senderResetKey={workspace.senderResetKey}
          isRunning={workspace.isRunning}
          streamingText={workspace.streamingText}
          isStreaming={workspace.isStreaming}
          history={workspace.history}
          hasMoreHistory={workspace.hasMoreHistory}
          isLoadingOlderHistory={workspace.isLoadingOlderHistory}
          events={workspace.events}
          onSend={workspace.handleGenerateDsl}
          onResolveQuestion={workspace.handleResolveQuestion}
          onLoadOlderHistory={workspace.handleLoadOlderHistory}
        />
      </div>
    </div>
  );
}

function StudioRoute({
  workspace,
  onNavigateToProjects,
}: {
  workspace: ReturnType<typeof useStudioWorkspace>;
  onNavigateToProjects: () => void;
}) {
  const { projectId } = useParams<{ projectId: string }>();
  const openingProjectRef = useRef<string | null>(null);
  const activeProjectId = workspace.activeProject?.id;
  const openProject = workspace.handleOpenProject;

  useEffect(() => {
    if (!projectId) {
      return;
    }

    if (activeProjectId === projectId) {
      openingProjectRef.current = null;
      return;
    }

    if (openingProjectRef.current === projectId) {
      return;
    }

    openingProjectRef.current = projectId;
    void openProject(projectId).finally(() => {
      openingProjectRef.current = null;
    });
  }, [projectId, activeProjectId, openProject]);

  return <StudioView workspace={workspace} onNavigateToProjects={onNavigateToProjects} />;
}

export default function App() {
  const workspace = useStudioWorkspace();
  const navigate = useNavigate();

  function handleOpenProject(projectId: string) {
    void workspace.handleOpenProject(projectId);
    navigate(`/studio/${projectId}`);
  }

  async function handleCreateProject(data: { name: string; description?: string; units: string; upAxis: string }) {
    await workspace.handleCreateProject(data as Record<string, unknown>);
    const targetProjectId = workspace.activeProject?.id;
    if (targetProjectId) {
      navigate(`/studio/${targetProjectId}`);
      return;
    }

    navigate('/studio');
  }

  return (
    <StudioThemeProvider>
      <Layout className="studio-root">
        <AppNav
          t={workspace.t}
          hasActiveProject={Boolean(workspace.activeProject)}
        />

        <Content className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/projects" replace />} />

            <Route
              path="/projects"
              element={
                <ProjectsPage
                  t={workspace.t}
                  projects={workspace.projects}
                  onCreateProject={handleCreateProject}
                  onOpenProject={handleOpenProject}
                  onLoadVersions={(projectId) => api.listVersions(projectId)}
                />
              }
            />

            <Route
              path="/assets"
              element={
                <div className="projects-page">
                  <Text type="secondary">{workspace.t('nav.assets')} — coming soon</Text>
                </div>
              }
            />

            <Route
              path="/studio"
              element={
                workspace.activeProject
                  ? <Navigate to={`/studio/${workspace.activeProject.id}`} replace />
                  : <Navigate to="/projects" replace />
              }
            />

            <Route
              path="/studio/:projectId"
              element={
                <StudioRoute workspace={workspace} onNavigateToProjects={() => navigate('/projects')} />
              }
            />
          </Routes>
        </Content>
      </Layout>

      <StudioDslModal
        t={workspace.t}
        open={workspace.dslModalOpen}
        onClose={() => workspace.setDslModalOpen(false)}
        dslTab={workspace.dslTab}
        onTabChange={workspace.setDslTab}
        dslDraft={workspace.dslDraft}
        onDraftChange={workspace.setDslDraft}
        dslObject={workspace.dslObject}
        dslDraftError={workspace.dslDraftError}
        onFormat={() => {
          try {
            workspace.setDslDraft(JSON.stringify(JSON.parse(workspace.dslDraft), null, 2));
          } catch {
            return;
          }
        }}
        onSave={() => workspace.handleSaveDslFromModal(workspace.dslDraft)}
      />
    </StudioThemeProvider>
  );
}
