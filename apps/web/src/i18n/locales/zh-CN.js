export default {
  app: {
    title: 'AI 3D 建模工作台',
    tagline: '面向项目级多轮会话的 3D DSL 智能建模工作台。'
  },
  sidebar: {
    newProject: '新建项目',
    projects: '项目列表',
    assetRegistry: '资源库',
    versions: '版本时间线',
    sessions: 'AI 会话'
  },
  toolbar: {
    noProjectSelected: '未选择项目',
    transport: '传输方式',
    units: '单位',
    unitsValue: '米制 / Y 轴向上',
    language: '语言',
    mode: '模式'
  },
  labels: {
    aiPrompt: 'Agent 消息',
    sceneDsl: '场景 DSL',
    preview: '预览',
    eventFeed: '运行事件流',
    questions: '待决策问题',
    currentVersion: '当前版本',
    noQuestions: '当前没有待处理的歧义问题。',
    noEvents: 'Agent 执行时，事件流会显示在这里。',
    sessionHistory: '会话历史',
    chatTitle: 'Agent 会话',
    decision: '决策',
    resolved: '已处理',
    noMessages: '暂无消息。开始向 Agent 发送消息吧。',
    loadingMore: '加载更多历史...',
    ctrlEnter: '回车发送，Shift+Enter 换行',
    dslViewer: '查看',
    dslEditor: '编辑',
    jsonValid: 'JSON 格式有效'
  },
  actions: {
    createProject: '创建项目',
    generateDsl: '发送给 Agent',
    saveDsl: '保存 DSL',
    editDsl: '编辑 DSL',
    exportZip: '导出 ZIP',
    exportGlb: '导出 GLB',
    reconnect: '重连事件流',
    createSession: '创建会话',
    resolve: '按此选项继续',
    formatJson: '格式化 JSON',
    cancel: '取消',
    sendMessage: '发送',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏'
  },
  errors: {
    jsonInvalid: '无效的 JSON'
  },
  status: {
    bootingWorkspace: '正在初始化工作区…',
    starterProjectCreated: '已创建起始项目。',
    loadedProjects: '已加载 {{count}} 个项目。',
    backendConnectionFailed: '后端连接失败，请先启动服务端。',
    openedProject: '已打开项目：{{name}}。',
    createdProject: '已创建项目：{{name}}。',
    dslSaved: 'DSL 已写入当前项目版本链。',
    generatingDsl: 'Agent 正在运行…',
    aiSceneUpdated: 'Agent 场景更新已提交。',
    projectZipExported: '项目 ZIP 已导出。',
    glbExported: '当前 Three.js 场景已导出为 GLB。',
    sessionReady: 'Agent 会话已就绪，当前模式：{{mode}}。',
    waitingUser: '正在等待你处理歧义选择。',
    streamConnected: '实时事件流已连接。',
    streamDisconnected: '实时事件流已断开。',
    sessionCompleted: 'Agent 运行完成。',
    sessionFailed: 'Agent 运行失败。'
  },
  defaults: {
    projectName: '起始项目',
    projectDescription: '默认 AI 3D 建模工作区',
    createdFromWeb: '通过 Web 工作台创建',
    aiPrompt: '在房间中央附近添加一把椅子和一张桌子。'
  },
  modes: {
    navigator: '导航模式',
    autopilot: '自动驾驶'
  }
};
