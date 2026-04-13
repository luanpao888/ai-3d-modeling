# AI 3D Modeling System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[English](./README.md) | [简体中文](./README.zh-CN.md)

An **AI-powered 3D modeling workspace** built to turn natural language conversations into structured 3D design iterations for real-world maker projects.

---

## 🚀 Project Overview

The original motivation for this project is very personal:

I’m still a **hands-on beginner** when it comes to making physical products and 3D models, but I wanted to build an **automatic cat water dispenser** for my cats — one with **auto water in/out flow** and the ability to **connect with smart home devices**.

The problem was that every time I tried to model ideas manually, I moved too slowly, made clumsy mistakes, and spent a lot of time fighting the tooling instead of exploring the product itself.

So this project was created around a simple idea:

> **use AI conversation as the modeling interface**, and let the 3D structure evolve continuously through dialogue.


---

## 🧱 Monorepo Structure

```text
project-root/
├── apps/
│   ├── server/       # Fastify backend, project system, asset registry, AI provider facade
│   ├── web/          # React + Vite + Three.js studio
│   └── electron/     # Electron shell with preload + IPC bridge
├── packages/
│   └── shared/       # Shared DSL schemas, validators, constants
├── docker/           # Dockerfiles for server and GUI stack
├── data/             # Local project storage volume mount
├── docker-compose.yml
├── docker-compose-local.yml
├── .env.template     # 
├── package.json
└── README.md
```

---

## ⚙️ How to Run

### Local Development

```bash
npm install
npm run dev:server
npm run dev:web
```

Open:

- Web UI: `http://localhost:5173`
- API: `http://localhost:3000/health`

### Desktop Development

```bash
npm install
npm run dev:desktop
```

This starts the backend, Vite frontend, and Electron shell together.

---

## 🐳 Docker

### Image names

- `ai-3d-modeling-server`
- `ai-3d-modeling-web`
- `ai-3d-modeling-full`

### Build and push to the private registry

```bash
npm run docker:build
npm run docker:push
```

Set these first in `.env`:

```bash
DOCKER_REGISTRY=
DOCKERHUB_NAMESPACE=
IMAGE_TAG=latest
```

### Pull remote images with Compose

Backend only:

```bash
docker compose up -d server
```

Server + web (separate containers):

```bash
docker compose --profile web up -d server web
```

Full image (frontend + backend in one image):

```bash
docker compose --profile full up -d full
```

### Build local images from source

```bash
docker compose -f docker-compose-local.yml build
```

---

## 🧭 Design

Detailed architecture, layer I/O contracts, database-oriented persistence strategy, and DSL interpretation plan are documented in [ARCHITECTURE.md](./ARCHITECTURE.md).

This README stays focused on quick start and runtime commands.

---

## License

This project is licensed under the **MIT License**.

---


