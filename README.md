<div align="center">

# 🧠 Cerebra

**AI-powered agentic treasury system for Stellar Soroban**

Cerebra lets DAOs, startups, and NGOs define intelligent treasury agents that monitor on-chain conditions and autonomously execute Stellar transactions — payments, contract calls, swaps — based on configurable rules, LLM decisions, or custom strategy plugins.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Code of Conduct](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

[Quickstart](#-quickstart) · [Architecture](docs/ARCHITECTURE.md) · [API Reference](docs/API.md) · [Plugin System](docs/PLUGIN_SYSTEM.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

</div>

---

## Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Quickstart](#-quickstart)
- [Configuration](#-configuration)
- [API Overview](#-api-overview)
- [Agent System](#-agent-system)
- [Simulation Mode](#-simulation-mode)
- [Plugin System](#-plugin-system)
- [WebSocket Events](#-websocket-events)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌐 Overview

Cerebra is an open-source backend that bridges AI decision-making with Stellar blockchain execution. You define **agents** — each with rules, triggers, and actions — and Cerebra evaluates them on a schedule or in response to on-chain events, then executes the appropriate Stellar transactions.

```
On-chain event / cron tick
        │
        ▼
  Agent Engine
  ┌─────────────────────────────┐
  │  Evaluate rules             │
  │  (plugin or LLM decision)   │
  │  → Build actions            │
  │  → Simulate or execute      │
  └─────────────────────────────┘
        │
        ▼
  Stellar / Soroban
  (payment, contract call, swap)
```

---

## ✨ Features

- **Agent Engine** — define agents with JSON rules, cron/event triggers, and on-chain actions
- **LLM Decision Layer** — optionally delegate rule evaluation to OpenAI (or any compatible model)
- **Simulation Mode** — dry-run agents before committing real transactions
- **Plugin System** — extend with custom strategy plugins (rebalance, DCA, yield routing, etc.)
- **Stellar / Soroban Integration** — native payments and Soroban smart contract calls
- **Treasury Tracking** — sync and cache multi-asset wallet balances
- **Event Listener** — poll Soroban contract events and trigger agents reactively
- **BullMQ Job Queues** — async, retryable agent and treasury jobs backed by Redis
- **WebSocket** — real-time push of blockchain events and agent execution results
- **Wallet Auth** — stateless Ed25519 signature verification (no passwords, no JWTs)
- **RBAC** — three roles: `ADMIN`, `OPERATOR`, `VIEWER`

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Language | TypeScript 5.5 |
| Framework | Express 4 |
| Database | PostgreSQL + Prisma ORM |
| Cache / Queue | Redis + BullMQ |
| Blockchain | Stellar SDK + Soroban RPC |
| AI | OpenAI API (pluggable) |
| Auth | Ed25519 wallet signatures (tweetnacl) |
| Logging | Pino |
| Validation | Zod |

---

## 📁 Project Structure

```
cerebra-backend/
├── prisma/
│   └── schema.prisma          # DB schema (7 models, 5 enums)
├── src/
│   ├── index.ts               # Entry point — HTTP + WebSocket server
│   ├── app.ts                 # Express app factory
│   ├── config.ts              # Env-driven config
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   └── redis.ts           # IORedis singleton
│   ├── types/
│   │   └── agent.ts           # RuleConfig, ActionConfig, AgentPlugin interfaces
│   ├── services/
│   │   ├── agent.engine.ts    # Core agent evaluation + execution
│   │   ├── transaction.service.ts  # Stellar payments + Soroban calls
│   │   ├── treasury.service.ts     # Balance sync + caching
│   │   └── event.listener.ts       # Soroban event polling
│   ├── queues/
│   │   ├── agent.queue.ts     # BullMQ queue definitions
│   │   ├── workers.ts         # Agent + treasury workers
│   │   └── scheduler.ts       # Periodic job scheduling
│   ├── routes/
│   │   ├── agents.ts          # /agents REST endpoints
│   │   ├── treasury.ts        # /treasury REST endpoints
│   │   └── transactions.ts    # /transactions REST endpoints
│   ├── middleware/
│   │   └── auth.ts            # Wallet signature auth + RBAC
│   ├── ws/
│   │   └── manager.ts         # WebSocket broadcast manager
│   └── plugins/
│       ├── registry.ts        # Plugin registry
│       └── rebalance.plugin.ts  # Example: auto-rebalance strategy
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 🚀 Quickstart

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 7+
- A Stellar testnet account (get one at [Stellar Laboratory](https://laboratory.stellar.org/))

### 1. Clone and install

```bash
git clone https://github.com/your-org/cerebra-backend.git
cd cerebra-backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/cerebra"
REDIS_URL="redis://localhost:6379"
STELLAR_NETWORK=testnet
TREASURY_SECRET_KEY=S...          # Your Stellar secret key
OPENAI_API_KEY=sk-...             # Optional — enables LLM decisions
SIMULATION_MODE=true              # Start in safe simulation mode
```

### 3. Set up the database

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Start the server

```bash
# Development (hot reload)
npm run dev

# Production
npm run build && npm start
```

The server starts on `http://localhost:3000`. Health check: `GET /health`.

---

## ⚙️ Configuration

All configuration is driven by environment variables. See [`.env.example`](.env.example) for the full list.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `STELLAR_NETWORK` | `testnet` | `testnet` or `mainnet` |
| `STELLAR_HORIZON_URL` | Testnet Horizon | Horizon server URL |
| `STELLAR_RPC_URL` | Testnet Soroban | Soroban RPC URL |
| `TREASURY_SECRET_KEY` | — | Stellar secret key for signing transactions |
| `OPENAI_API_KEY` | — | OpenAI key (leave blank to use rule-only evaluation) |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model used for LLM decisions |
| `AGENT_POLL_INTERVAL_MS` | `30000` | How often agents are evaluated (ms) |
| `SIMULATION_MODE` | `false` | Global simulation override — no real transactions |

---

## 🔌 API Overview

All endpoints require wallet signature authentication. See [docs/API.md](docs/API.md) for the full reference.

### Authentication Headers

```
X-Wallet-Address: G...          # Stellar public key
X-Signature: <hex>              # Ed25519 signature of "cerebra-auth:<timestamp>"
X-Timestamp: <unix-ms>          # Current timestamp (5-minute window)
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check (no auth) |
| `GET` | `/agents` | List all agents |
| `POST` | `/agents` | Create an agent |
| `GET` | `/agents/:id` | Get agent + last 10 executions |
| `PATCH` | `/agents/:id` | Update agent |
| `DELETE` | `/agents/:id` | Archive agent |
| `POST` | `/agents/:id/run` | Manually trigger agent |
| `GET` | `/treasury` | List tracked accounts |
| `POST` | `/treasury/track` | Start tracking a wallet |
| `GET` | `/treasury/:address/balances` | Get cached balances |
| `POST` | `/treasury/:address/sync` | Queue a balance sync |
| `GET` | `/treasury/:address/history` | On-chain transaction history |
| `GET` | `/transactions` | List submitted transactions |
| `GET` | `/transactions/:hash` | Get transaction status |
| `POST` | `/transactions` | Submit a manual transaction (ADMIN) |

---

## 🤖 Agent System

An agent is a JSON document with three parts:

### Rules

Conditions evaluated against the current treasury state:

```json
{
  "rules": [
    { "field": "XLM", "operator": "lt", "value": 100 }
  ]
}
```

Supported operators: `gt`, `lt`, `gte`, `lte`, `eq`, `neq`.

### Triggers

When the agent should be evaluated:

```json
{
  "triggers": [
    { "type": "cron", "cron": "*/30 * * * *" },
    { "type": "event", "eventType": "transfer" }
  ]
}
```

Trigger types: `cron`, `event`, `price`.

### Actions

What to do when rules pass:

```json
{
  "actions": [
    {
      "type": "payment",
      "destination": "G...",
      "amount": "50",
      "asset": "XLM"
    }
  ]
}
```

Action types: `payment`, `contract_call`, `swap`, `notify`.

### Full Example

```json
{
  "name": "XLM Low Balance Alert & Refill",
  "rules": [
    { "field": "XLM", "operator": "lt", "value": 100 }
  ],
  "triggers": [
    { "type": "cron", "cron": "*/5 * * * *" }
  ],
  "actions": [
    {
      "type": "payment",
      "destination": "GREFILL...",
      "amount": "200",
      "asset": "XLM"
    }
  ],
  "simulate": true
}
```

---

## 🧪 Simulation Mode

Set `"simulate": true` on an agent (or `SIMULATION_MODE=true` globally) to run the full evaluation pipeline without submitting any on-chain transactions. Executions are recorded with `status: SIMULATED` so you can audit what would have happened.

This is the recommended way to test new agents before going live.

---

## 🔧 Plugin System

Plugins let you replace the default rule evaluator and action builder with custom logic. See [docs/PLUGIN_SYSTEM.md](docs/PLUGIN_SYSTEM.md) for a full guide.

Quick example:

```typescript
import { pluginRegistry } from './plugins/registry';

pluginRegistry.register({
  id: 'my-strategy',
  async evaluate(ctx, rules) { /* return true/false */ },
  async buildActions(ctx) { /* return ActionConfig[] */ },
});
```

Set `"pluginId": "my-strategy"` on any agent to use it.

---

## 📡 WebSocket Events

Connect to `ws://localhost:3000/ws` to receive real-time events:

```json
{ "type": "blockchain_event", "data": { ... } }
```

Event types pushed over WebSocket:
- `blockchain_event` — new Soroban contract event captured

---

## 📚 Documentation

| Document | Description |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flow, component breakdown |
| [docs/API.md](docs/API.md) | Full REST + WebSocket endpoint reference |
| [docs/PLUGIN_SYSTEM.md](docs/PLUGIN_SYSTEM.md) | How to build and register agent plugins |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Setup, workflow, PR guidelines, code standards |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting and auth model |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community standards |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

```bash
# Fork → clone → branch
git checkout -b feat/my-feature

# Make changes, then
npm run build   # must compile clean
git commit -m "feat: describe your change"
git push origin feat/my-feature
# Open a PR
```

---

## 📄 License

[MIT](LICENSE) — © 2026 Cerebra Contributors
