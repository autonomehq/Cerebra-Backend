# Plugin System

Cerebra's plugin system lets you replace the default rule evaluator and action builder with completely custom strategy logic. Plugins are TypeScript modules that implement a simple three-method interface and register themselves with the plugin registry at startup.

---

## Table of Contents

- [Why Plugins?](#why-plugins)
- [The AgentPlugin Interface](#the-agentplugin-interface)
- [AgentContext](#agentcontext)
- [Writing a Plugin](#writing-a-plugin)
- [Registering a Plugin](#registering-a-plugin)
- [Activating a Plugin on an Agent](#activating-a-plugin-on-an-agent)
- [Built-in Plugins](#built-in-plugins)
- [Plugin Ideas](#plugin-ideas)
- [Best Practices](#best-practices)

---

## Why Plugins?

The default agent engine evaluates rules using simple field comparisons (e.g., `XLM < 100`) and optionally delegates to an LLM. This covers many use cases, but some strategies require:

- Complex multi-asset logic (e.g., portfolio rebalancing across 5 assets)
- External data sources (e.g., price feeds, off-chain signals)
- Stateful strategies (e.g., DCA that tracks how much has been invested)
- Custom action sequences that depend on intermediate results

Plugins give you full control over both the **decision** (should this agent act?) and the **action plan** (what should it do?).

---

## The AgentPlugin Interface

```typescript
// src/types/agent.ts

export interface AgentPlugin {
  /** Unique identifier — must match the pluginId set on the agent */
  id: string;

  /**
   * Decide whether the agent should execute.
   * Return true to proceed, false to skip.
   */
  evaluate(ctx: AgentContext, rules: RuleConfig[]): Promise<boolean>;

  /**
   * Build the list of actions to execute when evaluate() returns true.
   * The agent engine will execute these in order.
   */
  buildActions(ctx: AgentContext): Promise<ActionConfig[]>;
}
```

---

## AgentContext

Both `evaluate` and `buildActions` receive an `AgentContext` object:

```typescript
export interface AgentContext {
  /** The ID of the agent being evaluated */
  agentId: string;

  /** Current treasury balances: { "XLM": "1500.00", "USDC:G...": "500.00" } */
  treasury: Record<string, string>;

  /** Payload from the blockchain event that triggered this run (if event-triggered) */
  eventPayload?: Record<string, unknown>;

  /** Unix timestamp (ms) when this evaluation started */
  timestamp: number;
}
```

---

## Writing a Plugin

Create a new file in `src/plugins/`. The filename convention is `<name>.plugin.ts`.

### Minimal example

```typescript
// src/plugins/notify-low-balance.plugin.ts

import { AgentPlugin, AgentContext, RuleConfig, ActionConfig } from '../types/agent';
import { pluginRegistry } from './registry';

const notifyLowBalance: AgentPlugin = {
  id: 'notify-low-balance',

  async evaluate(ctx: AgentContext, rules: RuleConfig[]): Promise<boolean> {
    // Fire if XLM balance drops below 50
    const xlm = parseFloat(ctx.treasury['XLM'] ?? '0');
    return xlm < 50;
  },

  async buildActions(ctx: AgentContext): Promise<ActionConfig[]> {
    // Return a notify action (no on-chain transaction)
    return [
      {
        type: 'notify',
        // Custom fields can be added — the engine passes these through
        // to your notification handler
      },
    ];
  },
};

pluginRegistry.register(notifyLowBalance);
```

### DCA (Dollar-Cost Averaging) example

```typescript
// src/plugins/dca.plugin.ts

import { AgentPlugin, AgentContext, RuleConfig, ActionConfig } from '../types/agent';
import { pluginRegistry } from './registry';

const dcaPlugin: AgentPlugin = {
  id: 'dca',

  async evaluate(ctx: AgentContext, _rules: RuleConfig[]): Promise<boolean> {
    // Always execute — the cron trigger controls frequency
    return true;
  },

  async buildActions(ctx: AgentContext): Promise<ActionConfig[]> {
    const usdcBalance = parseFloat(ctx.treasury['USDC:G...'] ?? '0');
    if (usdcBalance < 10) return []; // Not enough to DCA

    // Buy $10 worth of XLM
    return [
      {
        type: 'swap',
        asset: 'USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        amount: '10',
        destination: 'XLM',
      },
    ];
  },
};

pluginRegistry.register(dcaPlugin);
```

### Using external data

```typescript
// src/plugins/price-guard.plugin.ts

import { AgentPlugin, AgentContext, RuleConfig, ActionConfig } from '../types/agent';
import { pluginRegistry } from './registry';

async function fetchXlmPrice(): Promise<number> {
  const res = await fetch('https://api.example.com/price/XLM');
  const data = await res.json() as { price: number };
  return data.price;
}

const priceGuard: AgentPlugin = {
  id: 'price-guard',

  async evaluate(ctx: AgentContext, _rules: RuleConfig[]): Promise<boolean> {
    const price = await fetchXlmPrice();
    // Only act if XLM price drops below $0.10
    return price < 0.10;
  },

  async buildActions(ctx: AgentContext): Promise<ActionConfig[]> {
    return [
      {
        type: 'payment',
        destination: 'GRESERVE...',
        amount: '1000',
        asset: 'XLM',
      },
    ];
  },
};

pluginRegistry.register(priceGuard);
```

---

## Registering a Plugin

Plugins register themselves by calling `pluginRegistry.register()` at module load time. You need to import the plugin module in `src/index.ts` so it runs at startup:

```typescript
// src/index.ts

// Load plugins
import './plugins/rebalance.plugin';
import './plugins/dca.plugin';          // add your plugin here
import './plugins/price-guard.plugin';  // and here
```

The order of imports does not matter — each plugin registers itself by its unique `id`.

---

## Activating a Plugin on an Agent

Set the `pluginId` field on an agent to the plugin's `id`:

```json
{
  "name": "Weekly DCA into XLM",
  "pluginId": "dca",
  "rules": [],
  "triggers": [
    { "type": "cron", "cron": "0 9 * * 1" }
  ],
  "actions": [],
  "simulate": false
}
```

When `pluginId` is set:
- `plugin.evaluate(ctx, rules)` is called instead of the default rule evaluator or LLM.
- `plugin.buildActions(ctx)` is called instead of using the agent's `actions` array.

When `pluginId` is not set, the default evaluator (rule comparison + optional LLM) is used and the agent's `actions` array is executed directly.

---

## Built-in Plugins

### `rebalance`

**File:** `src/plugins/rebalance.plugin.ts`

Evaluates the agent's rules using the same comparison logic as the default evaluator, then builds a swap action to rebalance USDC → XLM. This is an example plugin — customise it for your own rebalancing strategy.

**Usage:**

```json
{
  "pluginId": "rebalance",
  "rules": [
    { "field": "XLM", "operator": "lt", "value": 500 }
  ]
}
```

---

## Plugin Ideas

Here are some strategies you could build as plugins:

| Plugin | Description |
|---|---|
| `dca` | Dollar-cost average into an asset on a schedule |
| `yield-router` | Move idle assets to the highest-yield Soroban pool |
| `stop-loss` | Sell an asset if its price drops below a threshold |
| `multi-sig-approval` | Require off-chain approval before executing large transactions |
| `gas-optimizer` | Batch multiple payments into a single transaction |
| `portfolio-rebalance` | Maintain target allocations across multiple assets |
| `event-responder` | React to specific Soroban contract events with custom logic |

---

## Best Practices

**Keep plugins stateless.** If you need state (e.g., tracking how much has been DCA'd), store it in the database or Redis — not in module-level variables, which will be lost on restart.

**Handle errors gracefully.** If your plugin throws, the agent execution will be marked `FAILED`. Catch expected errors and return an empty actions array instead of throwing.

**Respect simulation mode.** The agent engine handles simulation — your plugin does not need to check `SIMULATION_MODE`. Just return the actions you would execute; the engine will skip the actual submission.

**Be idempotent.** Agents can be triggered multiple times in quick succession (e.g., by both a cron tick and an event). Design your plugin so that running it twice in a row does not cause unintended double-execution.

**Log meaningful context.** Use the logger to record what your plugin decided and why:

```typescript
import { logger } from '../utils/logger';

async evaluate(ctx, rules) {
  const xlm = parseFloat(ctx.treasury['XLM'] ?? '0');
  logger.debug({ agentId: ctx.agentId, xlm }, 'DCA plugin evaluating');
  return true;
}
```
