export default {
  app: {
    title: 'AI 3D 建模工作台',
    tagline: '面向 Web 与桌面端的本地优先 DSL 建模。'
  },
  sidebar: {
    newProject: '新建项目',
    projects: '项目列表',
    assetRegistry: '资源库'
  },
  toolbar: {
    noProjectSelected: '未选择项目',
    transport: '传输方式',
    ai: 'AI',
    units: '单位',
    unitsValue: '米制 / Y 轴向上',
    language: '语言'
  },
  labels: {
    aiPrompt: 'AI 提示词',
    sceneDsl: '场景 DSL',
    preview: 'Three.js 预览'
  },
  actions: {
    createProject: '创建项目',
    generateDsl: '生成 DSL',
    saveDsl: '保存 DSL',
    exportZip: '导出 ZIP',
    exportGlb: '导出 GLB'
  },
  status: {
    bootingWorkspace: '正在初始化工作区…',
    starterProjectCreated: '已创建起始项目。',
    loadedProjects: '已加载 {{count}} 个项目。',
    backendConnectionFailed: '后端连接失败，请先启动服务端。',
    openedProject: '已打开项目：{{name}}。',
    createdProject: '已创建项目：{{name}}。',
    dslSaved: 'DSL 已保存到本地。',
    generatingDsl: '正在使用当前 AI Provider 生成 DSL…',
    aiSceneUpdated: 'AI 场景更新已应用。',
    projectZipExported: '项目 ZIP 已导出。',
    glbExported: '当前 Three.js 场景已导出为 GLB。'
  },
  defaults: {
    projectName: '起始项目',
    projectDescription: '默认 AI 3D 建模工作区',
    createdFromWeb: '通过 Web 工作台创建',
    aiPrompt: '在房间中央附近添加一把椅子和一张桌子。'
  }
};
