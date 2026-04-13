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

## 🧭 设计说明

完整的设计思路、分层输入输出、数据库持久化策略、以及 DSL 解释与几何计算模式，请查看 [ARCHITECTURE.zh-CN.md](./ARCHITECTURE.zh-CN.md)。

本 README 仅保留项目简介与快速启动内容。

---

## 开源协议

本项目采用 **MIT License**。

---

