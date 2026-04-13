# Design

[English](./ARCHITECTURE.md) | [简体中文](./ARCHITECTURE.zh-CN.md)

This document is the single source of truth for architecture and design decisions.

## Scope

- AI-first DSL modeling workflow
- Decoupled rendering and geometry computation
- Database-oriented persistence for multi-user and multi-project versioning
- Export pipeline for rendering and manufacturing formats

## Core Principles

- Three.js is a rendering and interaction layer, not the geometric source of truth.
- DSL is a semantic scene description, not a mesh file format.
- Schema and interpreter boundaries isolate change and reduce refactor cost.
- Geometry precision is mode-based: fast by default, precise on demand.
- Persistence must support ownership, history, and auditability.

## Layered Architecture

| Layer | Input | Output | Data Type | Responsibilities | Goal |
|---|---|---|---|---|---|
| AI Generation | Natural language prompt + optional current scene context | Candidate DSL payload | JSON object | Convert user intent into structured scene intent | Stable machine-editable model intent |
| DSL Schema | Raw DSL candidate | Validated and normalized DSL | JSON object | Validation, defaults, constraints, compatibility | Deterministic and safe DSL contract |
| Persistence (Database) | Project events, DSL snapshots, metadata, artifact refs | Durable project/version records | DB records + blob/object refs | Multi-user isolation, project ownership, revision history, branching, auditing | Long lifecycle collaboration |
| Delivery API | Queries, commands, IDs | Typed responses, streams, and binaries | JSON/HTTP + binary payloads | Auth, authorization, version querying, patch application, export orchestration | Stable product contract |
| DSL Interpreter | Normalized DSL from persistence/API reads | Geometry IR (intermediate representation) | In-memory objects | Map semantic nodes to geometry commands and transforms | Decouple authoring from engine-specific implementation |
| Geometry Compute (Optional) | Geometry IR | Precision-managed geometry result | In-memory objects (mesh or B-Rep) | Boolean ops, param solving, tolerance handling | On-demand high-fidelity modeling |
| Render (Three.js) | Render-ready mesh/scene graph | Interactive viewport frames | Runtime GPU objects | Preview, camera controls, manipulation feedback | Fast visual iteration |
| Export | Geometry result + metadata | Exchange/manufacturing files | `.glb`, `.stl`, `.step`, `.3mf`, `.zip` | Conversion, packaging, compatibility checks | Bridge design to CAD/fabrication workflows |

## Geometry Compute Strategy

### Default: Low-Fidelity Mode

- Interpreter outputs render-ready meshes directly.
- Optimized for responsiveness and frequent iteration.
- Best for ideation, layout, and quick validation.

### Optional: High-Fidelity Mode

- Interpreter routes selected nodes through geometry compute.
- Precision and tolerance rules are applied before render/export.
- Best for manufacturing prep and strict dimension requirements.

## Persistence Strategy (Database First)

- Users can own multiple projects with strict access isolation.
- Each project keeps a version timeline (snapshots + patch history).
- DSL snapshots and geometry artifacts are independently versioned.
- Large exports are stored as artifact records with object storage references.
- APIs support rollback, compare, and branch/merge style iteration.

## Why This Architecture Scales

- DSL contract changes are localized to schema and interpreter.
- Geometry engine upgrades do not force renderer rewrites.
- Three.js remains replaceable as a presentation layer.
- Storage can evolve without changing DSL semantics.

## Notes for Implementation

- Keep Geometry IR explicit and versioned.
- Treat exporters as adapters over Geometry IR.
- Use async job orchestration for expensive high-fidelity compute/export.
- Keep patch operations idempotent where possible.
