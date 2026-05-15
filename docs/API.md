# API Reference

Full reference for every REST endpoint and the WebSocket interface.

---

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Error Responses](#error-responses)
- [Agents](#agents)
- [Treasury](#treasury)
- [Transactions](#transactions)
- [Health](#health)
- [WebSocket](#websocket)

---

## Base URL

```
http://localhost:3000
```

---

## Authentication

All endpoints except `GET /health` require three HTTP headers:

| Header | Description |
|---|---|
| `X-Wallet-Address` | Your Stellar public key (`G...`) |
| `X-Signature` | Hex-encoded Ed25519 signature of `cerebra-auth:<timestamp>` |
| `X-Timestamp` | Current Unix timestamp in milliseconds |

The timestamp must be within 5 minutes of the server clock (replay protection).

### Signing example (Node.js)

```typescript
import nacl from 'tweetnacl';
import { Keypair } from '@stellar/stellar-sdk';

const keypair = Keypair.fromSecret('S...');
const timestamp = Date.now().toString();
const message = Buffer.from(`cerebra-auth:${timestamp}`);
const signature = nacl.sign.detached(message, keypair.rawSecretKey());

const headers = {
  'X-Wallet-Address': keypair.publicKey(),
  'X-Signature': Buffer.from(signature).toString('hex'),
  'X-Timestamp': timestamp,
};
```

### Roles

| Role | Default | Permissions |
|---|---|---|
| `VIEWER` | ✓ new wallets | Read-only |
| `OPERATOR` | | Create/update agents, trigger runs, track treasury |
| `ADMIN` | | Full access including delete and manual transactions |

Role upgrades are done directly in the database by an administrator.

---

## Error Responses

```json
{ "error": "Human-readable description" }
```

| Status | Meaning |
|---|---|
| `400` | Validation failed (Zod) |
| `401` | Missing or invalid auth headers |
| `403` | Insufficient role |
| `404` | Resource not found |
| `500` | Internal server error |

---

## Agents

### GET /agents

List all agents.

**Auth:** Any role

**Response `200`:** Array of agent objects.

```json
[
  {
    "id": "clx...",
    "name": "XLM Refill",
    "status": "ACTIVE",
    "rules": [{ "field": "XLM", "operator": "lt", "value": 100 }],
    "triggers": [{ "type": "cron", "cron": "*/5 * * * *" }],
    "actions": [{ "type": "payment", "destination": "G...", "amount": "200", "asset": "XLM" }],
    "pluginId": null,
    "simulate": false,
    "lastRunAt": "2026-05-15T10:00:00.000Z",
    "createdAt": "2026-05-01T00:00:00.000Z"
  }
]
```

---

### POST /agents

Create a new agent.

**Auth:** `ADMIN` or `OPERATOR`

**Request body:**

```json
{
  "name": "XLM Refill",
  "description": "Refill when XLM drops below 100",
  "rules": [
    { "field": "XLM", "operator": "lt", "value": 100 }
  ],
  "triggers": [
    { "type": "cron", "cron": "*/5 * * * *" }
  ],
  "actions": [
    { "type": "payment", "destination": "GDEST...", "amount": "200", "asset": "XLM" }
  ],
  "pluginId": null,
  "simulate": true
}
```

**RuleConfig fields:**

| Field | Type | Values |
|---|---|---|
| `field` | string | Asset key e.g. `"XLM"`, `"USDC:G..."` |
| `operator` | string | `gt` `lt` `gte` `lte` `eq` `neq` |
| `value` | number \| string | Threshold |

**TriggerConfig fields:**

| Field | Type | Notes |
|---|---|---|
| `type` | string | `cron` `event` `price` |
| `cron` | string | Cron expression — required when `type=cron` |
| `eventType` | string | Soroban event type — required when `type=event` |

**ActionConfig fields:**

| Field | Type | Notes |
|---|---|---|
| `type` | string | `payment` `contract_call` `swap` `notify` |
| `destination` | string | Stellar address (payment) |
| `amount` | string | Decimal string e.g. `"100.00"` |
| `asset` | string | `"XLM"` or `"CODE:ISSUER"` |
| `contractId` | string | Soroban contract ID |
| `functionName` | string | Contract function name |
| `params` | array | Contract function arguments |

**Response `201`:** The created agent object.

---

### GET /agents/:id

Get a single agent with its last 10 execution records.

**Auth:** Any role

**Response `200`:**

```json
{
  "id": "clx...",
  "name": "XLM Refill",
  "status": "ACTIVE",
  "executions": [
    {
      "id": "clx...",
      "status": "SUCCESS",
      "simulated": false,
      "result": { "results": [{ "hash": "abc123" }] },
      "error": null,
      "triggeredBy": "cron",
      "createdAt": "2026-05-15T10:00:00.000Z"
    }
  ]
}
```

---

### PATCH /agents/:id

Update agent fields. Only included fields are changed.

**Auth:** `ADMIN` or `OPERATOR`

**Response `200`:** Updated agent object.

---

### DELETE /agents/:id

Soft-archive an agent. Archived agents are not evaluated.

**Auth:** `ADMIN`

**Response `204`:** No content.

---

### POST /agents/:id/run

Manually enqueue an agent evaluation.

**Auth:** `ADMIN` or `OPERATOR`

**Response `200`:**

```json
{ "queued": true }
```

---

## Treasury

### GET /treasury

List all tracked wallet accounts with cached balances.

**Auth:** Any role

**Response `200`:**

```json
[
  {
    "id": "clx...",
    "walletAddress": "GABC...",
    "label": null,
    "balances": [
      { "asset": "XLM", "balance": "1500.0000000" },
      { "asset": "USDC:GBBD47...", "balance": "500.00" }
    ],
    "lastSyncedAt": "2026-05-15T10:00:00.000Z"
  }
]
```

---

### POST /treasury/track

Start tracking a wallet. Immediately syncs balances from Horizon.

**Auth:** `ADMIN` or `OPERATOR`

**Request body:**

```json
{ "walletAddress": "GABC..." }
```

**Response `201`:** The created `TreasuryAccount` object.

---

### GET /treasury/:address/balances

Get cached balances for a wallet (Redis TTL: 30s, falls back to DB).

**Auth:** Any role

**Response `200`:**

```json
[
  { "asset": "XLM", "balance": "1500.0000000" }
]
```

---

### POST /treasury/:address/sync

Queue an immediate balance sync.

**Auth:** `ADMIN` or `OPERATOR`

**Response `200`:** `{ "queued": true }`

---

### GET /treasury/:address/history

Fetch the last 20 on-chain transactions from Stellar Horizon.

**Auth:** Any role

**Response `200`:**

```json
[
  {
    "hash": "abc123...",
    "ledger": 50000000,
    "createdAt": "2026-05-15T10:00:00Z",
    "operationCount": 1,
    "feePaid": "100"
  }
]
```

---

## Transactions

### GET /transactions

List submitted transactions, newest first.

**Auth:** Any role

**Query params:** `limit` (default `20`), `offset` (default `0`)

**Response `200`:** Array of transaction objects.

```json
[
  {
    "id": "clx...",
    "hash": "abc123...",
    "type": "PAYMENT",
    "status": "SUBMITTED",
    "fromAddress": "GSRC...",
    "toAddress": "GDEST...",
    "amount": "200",
    "asset": "XLM",
    "simulated": false,
    "agentId": "clx...",
    "createdAt": "2026-05-15T10:00:00.000Z"
  }
]
```

---

### GET /transactions/:hash

Get a transaction by its Stellar hash.

**Auth:** Any role

**Response `200`:** Transaction object. **`404`** if not found.

---

### POST /transactions

Submit a manual transaction directly (bypasses agent engine).

**Auth:** `ADMIN` only

**Request body:** An `ActionConfig` object:

```json
{
  "type": "payment",
  "destination": "GDEST...",
  "amount": "100",
  "asset": "XLM"
}
```

**Response `201`:** `{ "hash": "abc123..." }`

---

## Health

### GET /health

No authentication required. Use for load balancer and uptime checks.

**Response `200`:**

```json
{ "status": "ok", "ts": 1747324424982 }
```

---

## WebSocket

Connect to receive real-time blockchain events:

```
ws://localhost:3000/ws
```

No authentication required. All connected clients receive all events.

### Message format

```json
{ "type": "<event-type>", "data": { ... } }
```

### Event: `blockchain_event`

Emitted when the event listener captures a new Soroban contract event.

```json
{
  "type": "blockchain_event",
  "data": {
    "id": "clx...",
    "type": "transfer",
    "contractId": "CABC...",
    "ledger": 50000001,
    "txHash": "def456...",
    "payload": {},
    "createdAt": "2026-05-15T10:00:01.000Z"
  }
}
```

### Client example

```typescript
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3000/ws');
ws.on('message', (raw) => {
  const { type, data } = JSON.parse(raw.toString());
  console.log(type, data);
});
```
