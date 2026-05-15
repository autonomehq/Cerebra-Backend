# Architecture

This document describes the system design, component responsibilities, and data flow of the Cerebra backend.

---

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [Component Map](#component-map)
- [Data Flow](#data-flow)
  - [Cron-triggered agent run](#1-cron-triggered-agent-run)
  - [Event-triggered agent run](#2-event-triggered-agent-run)
  - [Manual API trigger](#3-manual-api-trigger)
- [Layer Responsibilities](#layer-responsibilities)
- [Database Schema](#database-schema)
- [Queue Architecture](#queue-architecture)
- [Authentication Model](#authentication-model)
- [Plugin System](#plugin-system)
- [Simulation Mode](#simulation-mode)
- [Observability](#observability)
- [Deployment Considerations](#deployment-considerations)

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cerebra Backend                          │
│                                                                 │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────────┐   │
│  │  REST    │   │  WebSocket   │   │   BullMQ Workers     │   │
│  │  API     │   │  /ws         │   │   (agents, treasury) │   │
│  └────┬─────┘   └──────┬───────┘   └──────────┬───────────┘   │
│       │                │                       │               │
│       └────────────────┴───────────────────────┘               │
│                        │                                        │
│              ┌──────────▼──────────┐                           │
│              │    Service Layer    │                           │
│              │  agent.engine.ts   │                           │
│              │  transaction.svc   │                           │
│              │  treasury.svc      │                           │
│              │  event.listener    │                           │
│              └──────────┬──────────┘                           │
│                         │                                       │
│          ┌──────────────┼──────────────┐                       │
│          │              │              │                        │
│   ┌──────▼──────┐ ┌─────▼─────┐ ┌────▼──────────┐            │
│   │  PostgreSQL │ │   Redis   │ │ Stellar / RPC │            │
│   │  (Prisma)   │ │ (cache +  │ │ (Horizon +    │            │
│   │             │ │  queues)  │ │  Soroban RPC) │            │
│   └─────────────┘ └───────────┘ └───────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Map

| Component | File | Responsibility |
|---|---|---|
| HTTP Server | `src/index.ts` | Starts Express + WebSocket, wires everything together |
| Express App | `src/app.ts` | Middleware stack, route mounting, error handler |
| Config | `src/config.ts` | Reads and validates all environment variables |
| Agent Engine | `src/services/agent.engine.ts` | Evaluates rules, calls LLM or plugin, executes actions |
| Transaction Service | `src/services/transaction.service.ts` | Builds and submits Stellar/Soroban transactions |
| Treasury Service | `src/services/treasury.service.ts` | Syncs balances from Horizon, caches in Redis |
| Event Listener | `src/services/event.listener.ts` | Polls Soroban RPC for contract events, triggers agents |
| BullMQ Queues | `src/queues/agent.queue.ts` | Queue definitions for `agents` and `treasury` |
| Workers | `src/queues/workers.ts` | Processes jobs from both queues |
| Scheduler | `src/queues/scheduler.ts` | Enqueues periodic agent runs and treasury syncs |
| Auth Middleware | `src/middleware/auth.ts` | Verifies Ed25519 wallet signatures, enforces RBAC |
| WebSocket Manager | `src/ws/manager.ts` | Maintains connected clients, broadcasts events |
| Plugin Registry | `src/plugins/registry.ts` | Map-based registry for strategy plugins |

---

## Data Flow

### 1. Cron-triggered agent run

```
Scheduler (setInterval)
  └─► agentQueue.add('run-all')
        └─► Worker picks up job
              └─► agentEngine.runAll()
                    └─► For each ACTIVE agent:
                          ├─► Load treasury balances (Redis cache → Prisma)
                          ├─► Evaluate rules (plugin OR LLM OR default)
                          ├─► If rules pass → build actions
                          ├─► If simulate=true → record SIMULATED execution
                          └─► Else → transactionService.execute(action)
                                └─► Submit to Stellar Horizon
                                      └─► Record transaction in DB
```

### 2. Event-triggered agent run

```
eventListener.start([contractId])
  └─► setInterval → rpc.getEvents()
        └─► New event found
              ├─► Save to BlockchainEvent table
              ├─► wsManager.broadcast({ type: 'blockchain_event', ... })
              └─► Find agents with matching eventType trigger
                    └─► agentQueue.add('run-agent', { agentId, eventPayload })
                          └─► Worker → agentEngine.runById(agentId, eventPayload)
```

### 3. Manual API trigger

```
POST /agents/:id/run
  └─► walletAuth middleware (verify Ed25519 signature)
        └─► requireRole('ADMIN', 'OPERATOR')
              └─► agentQueue.add('run-agent', { agentId })
                    └─► Worker → agentEngine.runById(agentId)
                          └─► (same as cron path above)
```

---

## Layer Responsibilities

### Routes (`src/routes/`)

- Parse and validate request bodies using Zod schemas.
- Delegate all business logic to services.
- Return appropriate HTTP status codes.
- Never access the database directly.

### Services (`src/services/`)

- Contain all business logic.
- Access the database through Prisma.
- Access Redis through the IORedis singleton.
- Call the Stellar SDK for on-chain operations.
- Do not import from routes or middleware.

### Queues (`src/queues/`)

- Define BullMQ queues and workers.
- Workers call service methods — they contain no business logic themselves.
- The scheduler enqueues recurring jobs using `setInterval`.

### Middleware (`src/middleware/`)

- `walletAuth` — verifies the Ed25519 signature and upserts the user record.
- `requireRole` — checks the user's role against the required roles for the route.

---

## Database Schema

Cerebra uses PostgreSQL with Prisma ORM. The schema lives in `prisma/schema.prisma`.

### Models

**User** — a wallet address with a role. Created automatically on first authenticated request.

**Agent** — the core entity. Contains `rules`, `triggers`, and `actions` as JSON columns, plus optional `pluginId` and `simulate` flag.

**AgentExecution** — an immutable log of every agent run. Status is one of `SUCCESS`, `FAILED`, `SKIPPED`, or `SIMULATED`.

**Transaction** — a record of every Stellar transaction submitted (or simulated). Linked to the agent that triggered it.

**TreasuryAccount** — a tracked wallet address with cached balances and last sync timestamp.

**BlockchainEvent** — a raw Soroban contract event captured by the event listener.

### Enums

| Enum | Values |
|---|---|
| `Role` | `ADMIN`, `OPERATOR`, `VIEWER` |
| `AgentStatus` | `ACTIVE`, `PAUSED`, `ARCHIVED` |
| `ExecutionStatus` | `SUCCESS`, `FAILED`, `SKIPPED`, `SIMULATED` |
| `TransactionType` | `PAYMENT`, `CONTRACT_CALL`, `CONTRACT_DEPLOY`, `SWAP` |
| `TransactionStatus` | `PENDING`, `SUBMITTED`, `CONFIRMED`, `FAILED` |

---

## Queue Architecture

Two BullMQ queues share a single Redis connection:

**`agents` queue**
- `run-all` — evaluate all active agents (enqueued by scheduler every `AGENT_POLL_INTERVAL_MS`)
- `run-agent` — evaluate a single agent by ID (enqueued by event listener or manual API trigger)

**`treasury` queue**
- `sync` — sync balances for a single wallet address (enqueued by scheduler every 60s or by API)

Workers run with concurrency limits (`agents: 5`, `treasury: 3`) to avoid overwhelming the Stellar Horizon API.

Failed jobs are retried automatically by BullMQ with exponential backoff. Completed jobs are pruned to keep Redis memory usage low.

---

## Authentication Model

Cerebra uses **stateless wallet signature authentication** — no passwords, no JWTs, no sessions.

**How it works:**

1. The client constructs the message `cerebra-auth:<unix-timestamp-ms>`.
2. The client signs this message with their Stellar Ed25519 private key.
3. The client sends three headers with every request:
   - `X-Wallet-Address` — the Stellar public key (G...)
   - `X-Signature` — the hex-encoded Ed25519 signature
   - `X-Timestamp` — the Unix timestamp in milliseconds
4. The server verifies:
   - The timestamp is within a 5-minute window (replay protection).
   - The signature is valid for the given public key and message.
5. On success, the server upserts a `User` record for the wallet address and attaches it to the request.

**RBAC roles:**

| Role | Permissions |
|---|---|
| `ADMIN` | Full access — create, update, delete agents; submit transactions; manage treasury |
| `OPERATOR` | Create and update agents; trigger runs; track treasury accounts |
| `VIEWER` | Read-only access to all resources |

New users are assigned `VIEWER` by default. Role upgrades must be done directly in the database by an administrator.

---

## Plugin System

The plugin system allows custom strategy logic to replace the default rule evaluator and action builder. See [PLUGIN_SYSTEM.md](PLUGIN_SYSTEM.md) for the full guide.

At startup, plugins are loaded by importing their module (e.g., `import './plugins/rebalance.plugin'`), which calls `pluginRegistry.register()`. The agent engine looks up the plugin by `pluginId` at evaluation time.

---

## Simulation Mode

Simulation mode can be enabled at two levels:

1. **Per-agent** — set `"simulate": true` on the agent document.
2. **Global** — set `SIMULATION_MODE=true` in the environment.

When simulation is active, the agent engine runs the full evaluation pipeline (rule check, LLM call, action building) but skips the `transactionService.execute()` call. An `AgentExecution` record with `status: SIMULATED` is written to the database so you can audit what would have happened.

---

## Observability

**Logging** — Pino is used throughout. In development, logs are pretty-printed. In production, logs are emitted as structured JSON for ingestion by log aggregators (Datadog, CloudWatch, etc.).

**HTTP request logging** — `pino-http` middleware logs every request with method, path, status code, and response time.

**Job monitoring** — BullMQ exposes a board-compatible API. You can connect [Bull Board](https://github.com/felixmosh/bull-board) or [Arena](https://github.com/bee-queue/arena) for a UI.

**Health check** — `GET /health` returns `{ status: 'ok', ts: <timestamp> }` with no authentication required. Use this for load balancer and uptime checks.

---

## Deployment Considerations

### Environment

- Set `NODE_ENV=production` to disable pretty-print logging and enable production optimisations.
- Set `SIMULATION_MODE=false` only after you have tested your agents in simulation.
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault) for `TREASURY_SECRET_KEY` and `OPENAI_API_KEY` in production.

### Scaling

- The HTTP server and workers can be scaled horizontally. BullMQ handles distributed job processing natively via Redis.
- The event listener should run as a single instance to avoid duplicate event processing. Use a leader-election mechanism (e.g., Redis `SET NX`) if you need high availability.

### Database

- Run `prisma migrate deploy` (not `migrate dev`) in production.
- Use connection pooling (PgBouncer or Prisma Accelerate) for high-traffic deployments.

### Redis

- Use Redis Sentinel or Redis Cluster for production high availability.
- BullMQ requires `maxRetriesPerRequest: null` on the IORedis connection — this is already set in `src/lib/redis.ts`.
