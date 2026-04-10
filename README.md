# AI 3D Modeling System

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

## 📦 Project Folder Model

Each modeling project is stored locally as a folder:

```text
my-project/
├── project.json
├── scenes/
├── assets/
├── exports/
└── meta/
```

Current backend endpoints include:

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

## 🧠 DSL Design Philosophy

> The DSL is **not** a mesh format.

It is intentionally high-level:

- It describes **scene structure**, not triangle-level geometry.
- AI generates **editable JSON DSL**, not `glTF` blobs.
- Reusable models are referenced via `assetId`, not raw URLs.
- Units are always **meters**.
- World orientation is always **Y-up**.
- Patch operations (`add`, `update`, `delete`) enable incremental AI edits.

This keeps generation deterministic, portable, auditable, and friendly to local storage.

---

## 🧾 Example DSL

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

## 🧩 Frontend Service Layer

The frontend resolves its transport dynamically:

- **Web mode:** HTTP client talks to the Fastify API.
- **Electron mode:** preload exposes an IPC-backed API bridge.

This keeps the UI code shared across browser and desktop shells.

---

## 📤 Export / Import

Implemented now:

- **Project ZIP export** from the backend
- **GLB export** from the Three.js frontend using `GLTFExporter`

Planned next:

- richer asset ingestion
- import validation flows
- offline sync / snapshot history

