import { Card, Layout, Typography } from 'antd';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
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

export default function App() {
  const workspace = useStudioWorkspace();
  const navigate = useNavigate();

  function handleOpenProject(projectId: string) {
    workspace.handleOpenProject(projectId);
    navigate('/studio');
  }

  async function handleCreateProject(data: { name: string; description?: string; units: string; upAxis: string }) {
    await workspace.handleCreateProject(data as Record<string, unknown>);
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
                <StudioView workspace={workspace} onNavigateToProjects={() => navigate('/projects')} />
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
