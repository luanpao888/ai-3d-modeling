export default {
  app: {
    title: 'AI 3D Modeling Studio',
    tagline: 'Local-first DSL authoring for web and desktop.'
  },
  sidebar: {
    newProject: 'New project',
    projects: 'Projects',
    assetRegistry: 'Asset registry'
  },
  toolbar: {
    noProjectSelected: 'No project selected',
    transport: 'Transport',
    ai: 'AI',
    units: 'Units',
    unitsValue: 'meter / Y-up',
    language: 'Language'
  },
  labels: {
    aiPrompt: 'AI prompt',
    sceneDsl: 'Scene DSL',
    preview: 'Three.js preview'
  },
  actions: {
    createProject: 'Create project',
    generateDsl: 'Generate DSL',
    saveDsl: 'Save DSL',
    exportZip: 'Export ZIP',
    exportGlb: 'Export GLB'
  },
  status: {
    bootingWorkspace: 'Booting workspace…',
    starterProjectCreated: 'Starter project created.',
    loadedProjects: 'Loaded {{count}} project(s).',
    backendConnectionFailed: 'Backend connection failed. Start the server first.',
    openedProject: 'Opened {{name}}.',
    createdProject: 'Created {{name}}.',
    dslSaved: 'DSL saved to disk.',
    generatingDsl: 'Generating DSL with the active AI provider…',
    aiSceneUpdated: 'AI scene update applied.',
    projectZipExported: 'Project ZIP exported.',
    glbExported: 'GLB exported from the current Three.js scene.'
  },
  defaults: {
    projectName: 'Starter Project',
    projectDescription: 'Default AI 3D modeling workspace',
    createdFromWeb: 'Created from the web studio',
    aiPrompt: 'Add a chair and a table near the center of the room.'
  }
};
