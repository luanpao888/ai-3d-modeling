import { useEffect, useMemo, useRef, useState } from 'react';

import { useI18n } from './i18n/I18nProvider.jsx';
import { exportDslToGlb, mountScenePreview } from './lib/renderDsl.js';
import { createApiClient } from './services/apiClient.js';

const api = createApiClient();

export default function App() {
  const { locale, setLocale, languages, t } = useI18n();
  const [projectName, setProjectName] = useState(() => t('defaults.projectName'));
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [dslText, setDslText] = useState('');
  const [prompt, setPrompt] = useState(() => t('defaults.aiPrompt'));
  const [assets, setAssets] = useState([]);
  const [providers, setProviders] = useState({ activeProvider: 'mock', configuredProviders: ['mock'] });
  const [status, setStatus] = useState({ key: 'status.bootingWorkspace' });
  const [error, setError] = useState('');
  const previewRef = useRef(null);

  const assetIndex = useMemo(
    () => Object.fromEntries(assets.map((asset) => [asset.id, asset])),
    [assets]
  );
  const transportMode = typeof window !== 'undefined' && window.ai3d ? 'IPC' : 'HTTP';

  useEffect(() => {
    document.title = t('app.title');
  }, [t]);

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    const parsedDsl = safeParseDsl(dslText) ?? activeProject?.dsl;
    const cleanup = mountScenePreview(previewRef.current, parsedDsl, assetIndex);
    return () => cleanup?.();
  }, [dslText, activeProject, assetIndex]);

  async function bootstrap() {
    try {
      const [registryAssets, providerInfo] = await Promise.all([
        api.searchAssets(''),
        api.getProviders()
      ]);

      setAssets(registryAssets);
      setProviders(providerInfo);

      const projectList = await api.listProjects();
      if (projectList.length === 0) {
        const created = await api.createProject({
          name: t('defaults.projectName'),
          description: t('defaults.projectDescription')
        });
        await syncProjects(created.id);
        openProjectData(created);
        setStatus({ key: 'status.starterProjectCreated' });
        return;
      }

      await syncProjects(projectList[0].id);
      const project = await api.getProject(projectList[0].id);
      openProjectData(project);
      setStatus({ key: 'status.loadedProjects', values: { count: projectList.length } });
    } catch (issue) {
      setError(issue.message);
      setStatus({ key: 'status.backendConnectionFailed' });
    }
  }

  async function syncProjects(selectedId) {
    const projectList = await api.listProjects();
    setProjects(projectList);

    if (selectedId) {
      const match = projectList.find((project) => project.id === selectedId);
      if (match && (!activeProject || activeProject.id !== selectedId)) {
        const fullProject = await api.getProject(selectedId);
        openProjectData(fullProject);
      }
    }
  }

  function openProjectData(project) {
    setActiveProject(project);
    setDslText(JSON.stringify(project.dsl, null, 2));
    setError('');
  }

  async function handleOpenProject(projectId) {
    try {
      const project = await api.getProject(projectId);
      openProjectData(project);
      setStatus({ key: 'status.openedProject', values: { name: project.name } });
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
      await syncProjects(created.id);
      openProjectData(created);
      setProjectName(nextProjectName);
      setStatus({ key: 'status.createdProject', values: { name: created.name } });
    } catch (issue) {
      setError(issue.message);
    }
  }

  async function handleSaveDsl() {
    if (!activeProject) {
      return;
    }

    try {
      const parsedDsl = JSON.parse(dslText);
      const saved = await api.saveDsl(activeProject.id, parsedDsl);
      openProjectData(saved);
      await syncProjects(saved.id);
      setStatus({ key: 'status.dslSaved' });
    } catch (issue) {
      setError(issue.message);
    }
  }

  async function handleGenerateDsl() {
    if (!activeProject) {
      return;
    }

    try {
      setStatus({ key: 'status.generatingDsl' });
      const currentDsl = safeParseDsl(dslText) ?? activeProject.dsl;
      const generatedDsl = await api.generateDsl({ prompt, currentDsl });
      const saved = await api.saveDsl(activeProject.id, generatedDsl);
      openProjectData(saved);
      setStatus({ key: 'status.aiSceneUpdated' });
    } catch (issue) {
      setError(issue.message);
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>{t('app.title')}</h1>
          <p>{t('app.tagline')}</p>
        </div>

        <section className="sidebar-section stack">
          <div>
            <label className="muted">{t('sidebar.newProject')}</label>
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
          </div>
          <button onClick={handleCreateProject}>{t('actions.createProject')}</button>
        </section>

        <section className="sidebar-section stack">
          <div className="muted">{t('sidebar.projects')}</div>
          {projects.map((project) => (
            <button
              key={project.id}
              className={`project-item ${activeProject?.id === project.id ? 'active' : ''}`}
              onClick={() => handleOpenProject(project.id)}
            >
              <strong>{project.name}</strong>
              <div className="muted">{project.id}</div>
            </button>
          ))}
        </section>

        <section className="sidebar-section stack">
          <div className="muted">{t('sidebar.assetRegistry')}</div>
          {assets.map((asset) => (
            <div className="asset-item" key={asset.id}>
              <strong>{asset.name}</strong>
              <div className="muted">{asset.id}</div>
            </div>
          ))}
        </section>
      </aside>

      <main className="main-panel">
        <section className="toolbar">
          <div>
            <h2 style={{ margin: 0 }}>{activeProject?.name ?? t('toolbar.noProjectSelected')}</h2>
            <p className="muted">{renderStatus(t, status)}</p>
          </div>

          <div className="toolbar-controls">
            <div className="language-switcher">
              <label className="muted" htmlFor="language-select">
                {t('toolbar.language')}
              </label>
              <select
                id="language-select"
                className="language-select"
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
              >
                {languages.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="badges">
              <span className="badge">
                {t('toolbar.transport')}: {transportMode}
              </span>
              <span className="badge">
                {t('toolbar.ai')}: {providers.activeProvider}
              </span>
              <span className="badge">
                {t('toolbar.units')}: {t('toolbar.unitsValue')}
              </span>
            </div>
          </div>
        </section>

        {error ? <div className="error-banner">{error}</div> : null}

        <section className="card stack">
          <label className="muted">{t('labels.aiPrompt')}</label>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          <div className="actions">
            <button onClick={handleGenerateDsl} disabled={!activeProject}>
              {t('actions.generateDsl')}
            </button>
            <button className="secondary" onClick={handleSaveDsl} disabled={!activeProject}>
              {t('actions.saveDsl')}
            </button>
            <button className="secondary" onClick={handleDownloadZip} disabled={!activeProject}>
              {t('actions.exportZip')}
            </button>
            <button className="secondary" onClick={handleExportGlb} disabled={!activeProject}>
              {t('actions.exportGlb')}
            </button>
          </div>
        </section>

        <section className="editor-grid">
          <div className="card stack">
            <label className="muted">{t('labels.sceneDsl')}</label>
            <textarea value={dslText} onChange={(event) => setDslText(event.target.value)} />
          </div>

          <div className="card stack">
            <label className="muted">{t('labels.preview')}</label>
            <div className="preview" ref={previewRef} />
          </div>
        </section>
      </main>
    </div>
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

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
