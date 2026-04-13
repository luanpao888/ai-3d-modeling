# AI 3D 建模系统

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[English](./README.md) | [简体中文](./README.zh-CN.md)

一个 **AI 驱动的 3D 建模工作台**，希望通过自然语言对话，把真实产品创意持续转化为可迭代的 3D 结构方案。

---

## 🚀 项目初衷

这个项目的出发点很个人化。

我是一个手工和硬件制作新手，想给家里的猫做一个自动上下水、可联动智能家居的饮水器。

但在传统建模流程里，很多时间会消耗在工具操作上，而不是产品想法本身。

所以这个系统的核心目标是：

> 把“对话”变成建模入口，让 AI 帮我把结构想法持续推进。

---

## 🧱 Monorepo 结构

```text
project-root/
├── apps/
│   ├── server/       # Fastify 后端、项目系统、资产注册、AI provider 封装
│   ├── web/          # React + Vite + Three.js Web 工作台
│   └── electron/     # Electron 桌面外壳（preload + IPC bridge）
├── packages/
│   └── shared/       # 共享 DSL schema、校验器、常量定义
├── docker/           # Dockerfiles
├── data/             # 本地项目数据目录 / volume 挂载点
├── docker-compose.yml
├── docker-compose-local.yml
├── .env.template
├── package.json
└── README.md
```

---

## ⚙️ 如何运行

### 本地开发

```bash
npm install
npm run dev:server
npm run dev:web
```

打开：

- Web UI: `http://localhost:5173`
- API: `http://localhost:3000/health`

### 桌面开发

```bash
npm install
npm run dev:desktop
```

这会同时启动后端、Vite 前端和 Electron 桌面应用。

---

## 🐳 Docker

### 镜像名称

- `ai-3d-modeling-server`
- `ai-3d-modeling-web`
- `ai-3d-modeling-full`

### 构建并推送到私有镜像仓库

```bash
docker login registry.katrina.kim:10443
npm run docker:build
npm run docker:push
```

请先在 `.env` 中配置：

```bash
DOCKER_REGISTRY=registry.katrina.kim:10443
DOCKERHUB_NAMESPACE=katrina
IMAGE_TAG=latest
```

### 从远端镜像启动

仅启动后端：

```bash
docker compose up -d server
```

前后端分离部署：

```bash
docker compose --profile web up -d server web
```

前后端打包在同一镜像：

```bash
docker compose --profile full up -d full
```

### 从源码本地构建镜像

```bash
docker compose -f docker-compose-local.yml build
```

---

## 🏗️ 实现架构

系统将演进为分层架构：**Three.js 只负责渲染与交互**，schema 校验、DSL 解释、几何精度计算、持久化分别解耦。

### 分层输入/输出与目标

| 层次 | 输入 | 输出 | 数据形态 | 主要工作 | 最终目的 |
|---|---|---|---|---|---|
| AI 生成层 | 自然语言 prompt + 可选当前场景上下文 | 候选 DSL 载荷 | JSON 对象 | 生成结构稳定、可编辑的设计意图 | 将用户意图转成机器可处理的场景描述 |
| DSL Schema 层 | 原始 DSL 候选 | 校验并归一化后的 DSL | JSON 对象 | schema 校验、默认值补齐、单位/坐标约束、向后兼容 | 保证 DSL 可预测、可验证、可演进 |
| DSL 解释器层 | 归一化 DSL | 几何中间表示（Geometry IR） | 内存对象 | 将语义节点翻译为几何命令（primitive/lathe/extrude/csg/brep） | 解耦 DSL 编排与渲染/导出实现 |
| 几何计算层（可选） | Geometry IR | 精度控制后的几何结果 | 内存对象（mesh 或 B-Rep） | 布尔运算、参数求解、公差与精度处理 | 满足按需高精度建模与制造场景 |
| 持久化层（数据库） | 项目事件/DSL 快照/元数据 | 可追溯项目与版本记录 | 数据库记录 + 对象/Blob 引用 | 多用户隔离、项目归属、版本链、分支、审计日志 | 支持多人协作和长期迭代 |
| 交付层（API） | 查询条件、命令、ID | 结构化响应与任务流 | JSON/HTTP（含二进制下载） | 鉴权、授权、版本读取、patch 应用、导出编排 | 提供稳定的产品接口契约 |
| 渲染层（Three.js） | 可渲染 mesh/scene graph | 交互视口帧 | 运行时 GPU 对象 | 预览、操作反馈、镜头控制 | 快速可视化迭代 |
| 导出层 | 几何结果 + 项目元数据 | 制造或交换格式文件 | `.glb`, `.stl`, `.step`, `.3mf`, `.zip` | 格式转换、打包、兼容性检查 | 打通设计到制造/CAD 工具链 |

### 几何计算层策略

- 默认低保真模式：DSL 解释器直接输出可渲染 mesh，优先实时性和交互体验。
- 可选高保真模式：在 DSL 解释阶段按策略启用几何计算层，对目标节点做精度优化后，再交给渲染和导出。

这样可以同时满足：

- 日常快速迭代（默认快）
- 制造前精度收敛（按需准）
- 减少全链路高精度带来的性能和复杂度成本

### 数据库持久化方向

引入数据库后，项目数据不再依赖本地文件夹。目标模型：

- 一个用户可管理多个项目，并具备访问隔离。
- 每个项目保存版本时间线（快照 + patch 历史）。
- DSL 与几何产物可独立版本化。
- 大体积导出文件通过制品记录 + 对象存储引用管理。
- API 支持回滚、对比，以及分支/合并式迭代。

### 为什么这能降低后期重构成本

- DSL 变更收敛在 schema 与解释器边界。
- 几何引擎升级不会强耦合渲染层重写。
- Three.js 仅作为呈现层，不承担几何真值。
- 持久化可从本地文件平滑迁移到数据库/对象存储，不改变 DSL 语义。

### 当前后端 API

- `GET /health`
- `GET /projects`
- `POST /projects`
- `GET /projects/:projectId`
- `PUT /projects/:projectId/dsl`
- `PATCH /projects/:projectId/dsl`
- `GET /assets/:id`
- `GET /assets/search`
- `POST /ai/generate-dsl`
- `GET /exports/:projectId/zip`

---

## 🧾 DSL 示例

```json
{
  "version": "1.0.0",
  "units": "meter",
  "upAxis": "Y",
  "metadata": {
    "sceneName": "Simple Room",
    "prompt": "Add a chair near a table"
  },
  "nodes": [
    {
      "id": "floor",
      "kind": "primitive",
      "primitive": "plane",
      "dimensions": { "width": 6, "height": 6 },
      "rotation": [-1.5708, 0, 0],
      "material": { "color": "#dbeafe" }
    },
    {
      "id": "chair-1",
      "kind": "asset",
      "assetId": "furniture:chair-basic",
      "position": [1, 0, 0]
    }
  ]
}
```

---

## 🧩 前端服务层

前端会根据运行环境动态选择通信方式：

- Web 模式：通过 HTTP 调用 Fastify API
- Electron 模式：通过 preload 暴露的 IPC bridge 通信

这样可以在不改 UI 逻辑的情况下，同时支持浏览器和桌面端。

---

## 开源协议

本项目采用 **MIT License**。

---

## 导出 / 导入

当前已实现：

- 后端导出项目 ZIP
- 前端基于 Three.js `GLTFExporter` 导出 GLB

后续计划：

- 更完整的资源导入流程
- 更强的结构校验与版本管理
- 离线快照 / 历史版本机制

---

## 🛣️ 后续规划

- 更适合复杂建模流程的 AI 编排（例如 LangGraph）
- 更强的 DSL patch 规划与多步修正
- 规范化资产导入与复用机制
- 更接近真实产品设计流程的结构约束能力
