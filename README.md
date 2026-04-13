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

## 🏗️ Implementation Architecture (Refactor Plan)

The system is evolving into a layered architecture where **Three.js handles rendering only**, while schema validation, interpretation, geometric precision, and persistence are decoupled.

### Layer-by-layer inputs, outputs, and goals

| Layer | Input | Output | Data Type | Main Work | Final Goal |
|---|---|---|---|---|---|
| AI Generation Layer | Natural language prompt + optional current scene context | Candidate DSL payload | JSON object | Generate editable design intent with stable structure | Convert user intent into machine-editable scene data |
| DSL Schema Layer | Raw DSL candidate | Validated and normalized DSL | JSON object | Schema validation, defaults, unit/axis constraints, backward compatibility | Ensure deterministic and model-safe DSL |
| DSL Interpreter Layer | Normalized DSL | Geometry Intermediate Representation (Geometry IR) | In-memory objects | Translate semantic nodes into geometry commands (primitive/lathe/extrude/csg/brep) | Decouple authoring DSL from render/export engines |
| Geometry Compute Layer | Geometry IR | Precision-managed geometry result | In-memory objects (mesh or B-Rep) | Boolean ops, parameter solving, precision and tolerance handling | Support high-precision modeling workflows |
| Persistence Layer (Database) | Project/domain events + DSL snapshots + metadata | Durable project/version records | Database rows/documents + object/blob references | Multi-user isolation, project ownership, revisions, branching, audit trail | Enable collaboration and long lifecycle project management |
| Delivery Layer (API) | IDs, queries, mutation commands | Typed API responses and streams | JSON/HTTP (plus binary download endpoints) | Auth, authorization, version query, patch apply, export task orchestration | Provide stable product-facing contract |
| Render Layer (Three.js) | Render-ready mesh/scene graph | Interactive viewport frame | Runtime GPU objects | Preview, camera control, manipulation feedback | Fast visual iteration and UX |
| Export Layer | Geometry result + project metadata | Manufacturing or exchange files | `.glb`, `.stl`, `.step`, `.3mf`, `.zip` | Format conversion, packaging, compatibility checks | Bridge design workflow to fabrication/CAD/toolchain |

### Database-oriented persistence direction

With database-backed persistence, project data is no longer tied to local folders only. The target model is:

- Users can own multiple projects with isolated access control.
- Each project keeps a version timeline (snapshots + patch history).
- DSL and geometry artifacts can be independently versioned.
- Large binary exports are tracked as artifact records with storage references.
- APIs can support rollback, compare, and branch/merge style iteration.

### Why this architecture reduces future refactor risk

- DSL changes remain localized to schema/interpreter boundaries.
- Geometry engine upgrades do not force renderer rewrites.
- Three.js stays a presentation layer, not the source of geometric truth.
- Persistence can evolve from local files to database/object storage without changing DSL semantics.

### Current backend endpoints

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

## License

This project is licensed under the **MIT License**.

---

## Export / Import

Implemented now:

- **Project ZIP export** from the backend
- **GLB export** from the Three.js frontend using `GLTFExporter`

Planned next:

- richer asset ingestion
- import validation flows
- offline sync / snapshot history

