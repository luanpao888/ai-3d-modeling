# AI 3D 建模系统

一个**AI 驱动的 3D 建模工作台**，希望通过自然语言对话的方式，把真实的产品创意持续转化为可迭代的 3D 结构方案。

---

## 🚀 项目初衷

这个项目的出发点其实非常个人化。

我是一个**手工和硬件制作新手**，想给家里的猫猫做一个 **自动上下水**、并且能够**联动智能家居**的饮水器。

但问题是，我对 3D 建模并不算熟练。很多时候一个小结构都要反复摸索很久，容易手忙脚乱，把大量时间花在建模工具本身，而不是产品想法上。

于是我开始想：

> 能不能把“对话”变成建模入口，让 AI 帮我持续地把想法往前推进？

所以这个系统的核心目标，就是通过 **AI 对话 + DSL 场景描述 + Three.js 可视化预览**，把建模过程变成一个可逐步迭代、可持续修正、对新手更友好的流程。


---

## 🧱 Monorepo 结构

```text
project-root/
├── apps/
│   ├── server/       # Fastify 后端、项目系统、资源注册表、AI Provider 封装
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

这会同时启动：

- 后端服务
- Vite 前端
- Electron 桌面应用

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

## 📦 项目目录模型

每个建模项目在本地都是一个独立文件夹：

```text
my-project/
├── project.json
├── scenes/
├── assets/
├── exports/
└── meta/
```

当前后端 API 包括：

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

## 🧠 DSL 设计理念

> DSL **不是** 网格（mesh）格式。

它是一个有意保持高层抽象的场景描述语言：

- 它描述的是**结构关系**，不是三角面细节。
- AI 生成的是**可编辑 JSON DSL**，不是直接输出 `glTF` 网格。
- 可复用模型通过 `assetId` 引用，而不是直接写原始 URL。
- 单位统一为 **meter（米）**。
- 世界坐标统一为 **Y-up**。
- 通过 `add / update / delete` patch 操作，可以逐步修改结构。

这使得整个生成过程更稳定、更可审计，也更适合本地项目长期演进。

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

- **Web 模式**：通过 HTTP 调用 Fastify API
- **Electron 模式**：通过 preload 暴露的 IPC bridge 通信

这样可以在不改 UI 逻辑的情况下，同时支持浏览器和桌面端。

---

## 📤 导出 / 导入

当前已实现：

- 后端导出 **项目 ZIP**
- 前端基于 Three.js `GLTFExporter` 导出 **GLB**

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
