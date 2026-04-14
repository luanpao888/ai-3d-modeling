import { Card, Layout, Typography } from 'antd';
import 'react18-json-view/src/style.css';

import { StudioChatPanel } from './components/studio/StudioChatPanel';
import { StudioDslModal } from './components/studio/StudioDslModal';
import { StudioPreviewPanel } from './components/studio/StudioPreviewPanel';
import { StudioSidebar } from './components/studio/StudioSidebar';
import { StudioThemeProvider } from './components/studio/StudioThemeProvider';
import { StudioToolbar } from './components/studio/StudioToolbar';
import { useStudioWorkspace } from './hooks/useStudioWorkspace';

const { Sider, Content } = Layout;
const { Text } = Typography;

export default function App() {
  const workspace = useStudioWorkspace();

  return (
    <StudioThemeProvider>
      <Layout className="studio-root">
        <Sider
          className="studio-sider"
          width={320}
          collapsedWidth={72}
          collapsed={workspace.sidebarCollapsed}
          trigger={null}
        >
          <StudioSidebar
            collapsed={workspace.sidebarCollapsed}
            onToggle={() => workspace.setSidebarCollapsed((value: boolean) => !value)}
            t={workspace.t}
            projectName={workspace.projectName}
            onProjectNameChange={workspace.setProjectName}
            onCreateProject={workspace.handleCreateProject}
            projects={workspace.projects}
            activeProjectId={workspace.activeProject?.id}
            onOpenProject={workspace.handleOpenProject}
            versions={workspace.versions}
            assets={workspace.assets}
          />
        </Sider>

        <Content className="studio-content">
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