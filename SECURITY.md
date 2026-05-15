# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email: **security@cerebra.dev** *(replace with your actual contact)*

Include:
- Description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested mitigations

We will acknowledge within **48 hours** and aim to release a fix within **14 days** for critical issues. We will credit you in the release notes unless you prefer anonymity.

---

## Authentication Model

Cerebra uses **stateless Ed25519 wallet signature authentication** — no passwords, no JWTs, no sessions.

### How it works

1. Client constructs the challenge: `cerebra-auth:<unix-timestamp-ms>`
2. Client signs it with their Stellar Ed25519 private key
3. Client sends three headers per request:
   - `X-Wallet-Address` — Stellar public key
   - `X-Signature` — hex-encoded Ed25519 signature
   - `X-Timestamp` — Unix timestamp in milliseconds
4. Server rejects timestamps older than 5 minutes (replay protection), decodes the public key, and verifies the signature with `tweetnacl`

### Security properties

- No secret stored server-side — only the public key is stored
- Replay protection via 5-minute timestamp window
- No session tokens to steal or forge
- Authentication is tied directly to Stellar key ownership

---

## Role-Based Access Control

| Role | Default | Permissions |
|---|---|---|
| `VIEWER` | All new wallets | Read-only |
| `OPERATOR` | Assigned by admin | Create/update agents, trigger runs, track wallets |
| `ADMIN` | Assigned by admin | Full access including delete and manual transactions |

Role upgrades must be done directly in the database. There is no API endpoint for role changes — this is intentional to prevent privilege escalation.

---

## Treasury Key Security

`TREASURY_SECRET_KEY` is the most sensitive credential in the system. It signs all on-chain transactions.

**Recommendations:**

- Store it in a secrets manager (AWS Secrets Manager, HashiCorp Vault) — never in `.env` files committed to version control
- Use a dedicated treasury wallet with only the funds needed for operations
- Enable Stellar multi-signature on the treasury account for high-value deployments
- Rotate the key immediately if you suspect compromise
- Never log the key — the codebase does not, but be careful in custom plugins

---

## Simulation Mode

Always test new agents in simulation mode before going live:

```env
SIMULATION_MODE=true   # global
```

Or per-agent: `"simulate": true`. No transactions are submitted; executions are recorded as `SIMULATED`.

---

## Input Validation

All request bodies are validated with Zod before reaching any service logic. Invalid requests are rejected with `400 Bad Request`.

---

## Known Limitations

- **WebSocket has no authentication.** All connected clients receive all broadcast events. Add auth to the WS upgrade handler if events contain sensitive data.
- **Single treasury key.** All transactions are signed by one key. Multi-signature support is on the roadmap.
- **Role management has no API.** Roles must be changed in the database directly.
