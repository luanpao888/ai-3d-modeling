const en = {
  app: {
    title: 'AI 3D Modeling Studio',
    tagline: 'Project-scoped agent sessions for conversational 3D DSL authoring.'
  },
  sidebar: {
    newProject: 'New project',
    projects: 'Projects',
    assetRegistry: 'Asset registry',
    versions: 'Version timeline',
    sessions: 'AI session'
  },
  toolbar: {
    noProjectSelected: 'No project selected',
    transport: 'Transport',
    units: 'Units',
    unitsValue: 'meter / Y-up',
    language: 'Language',
    mode: 'Mode'
  },
  labels: {
    aiPrompt: 'Agent message',
    sceneDsl: 'Scene DSL',
    preview: 'preview',
    eventFeed: 'Run feed',
    questions: 'Pending decisions',
    currentVersion: 'Current version',
    noQuestions: 'No pending ambiguity checkpoints.',
    noEvents: 'The event stream will appear here during agent execution.',
    sessionHistory: 'Session history',
    chatTitle: 'Agent Session',
    decision: 'Decision',
    resolved: 'Resolved',
    noMessages: 'No messages yet. Start by sending a message to the agent.',
    loadingMore: 'Loading more history...',
    pullToLoadPrevious: 'Scroll up to load older messages',
    noMoreMessagesTop: 'No more messages',
    ctrlEnter: 'Press Enter to send, Shift+Enter for a new line',
    dslViewer: 'Viewer',
    dslEditor: 'Editor',
    jsonValid: 'JSON is valid.'
  },
  actions: {
    createProject: 'Create project',
    generateDsl: 'Send to agent',
    saveDsl: 'Save DSL',
    editDsl: 'Edit DSL',
    export: 'Export',
    exportZip: 'Export ZIP',
    exportGlb: 'Export GLB',
    reconnect: 'Reconnect stream',
    createSession: 'Create session',
    resolve: 'Continue with this option',
    formatJson: 'Format JSON',
    cancel: 'Cancel',
    sendMessage: 'Send',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen'
  },
  errors: {
    jsonInvalid: 'Invalid JSON'
  },
  status: {
    bootingWorkspace: 'Booting workspace…',
    starterProjectCreated: 'Starter project created.',
    loadedProjects: 'Loaded {{count}} project(s).',
    backendConnectionFailed: 'Backend connection failed. Start the server first.',
    openedProject: 'Opened {{name}}.',
    createdProject: 'Created {{name}}.',
    dslSaved: 'DSL saved to the current project version chain.',
    generatingDsl: 'Running the project agent…',
    aiSceneUpdated: 'Agent scene update committed.',
    projectZipExported: 'Project ZIP exported.',
    glbExported: 'GLB exported from the current Three.js scene.',
    sessionReady: 'Agent session ready in {{mode}} mode.',
    waitingUser: 'Waiting for your decision on an ambiguity checkpoint.',
    streamConnected: 'Live event stream connected.',
    streamDisconnected: 'Live event stream disconnected.',
    sessionCompleted: 'Agent run completed.',
    sessionFailed: 'Agent run failed.'
  },
  defaults: {
    projectName: 'Starter Project',
    projectDescription: 'Default AI 3D modeling workspace',
    createdFromWeb: 'Created from the web studio',
    aiPrompt: 'Add a chair and a table near the center of the room.'
  },
  modes: {
    navigator: 'Navigator',
    navigatorDesc: 'Manual mode where you guide each step and review agent outputs.',
    autopilot: 'Autopilot',
    autopilotDesc: 'Let the agent run autonomously with minimal intervention.'
  }
};

export default en;