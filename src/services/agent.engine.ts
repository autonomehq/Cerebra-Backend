import { Agent } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { pluginRegistry } from '../plugins/registry';
import { transactionService } from './transaction.service';
import { treasuryService } from './treasury.service';
import { AgentContext, RuleConfig, ActionConfig, TriggerConfig } from '../types/agent';
import { config } from '../config';
import OpenAI from 'openai';

const openai = config.openai.apiKey ? new OpenAI({ apiKey: config.openai.apiKey }) : null;

// Default rule evaluator (no plugin)
function evaluateRules(rules: RuleConfig[], ctx: AgentContext): boolean {
  return rules.every((rule) => {
    const actual = parseFloat(ctx.treasury[rule.field] ?? '0');
    const expected = Number(rule.value);
    switch (rule.operator) {
      case 'gt':  return actual > expected;
      case 'lt':  return actual < expected;
      case 'gte': return actual >= expected;
      case 'lte': return actual <= expected;
      case 'eq':  return actual === expected;
      case 'neq': return actual !== expected;
      default:    return false;
    }
  });
}

async function llmDecide(ctx: AgentContext, rules: RuleConfig[]): Promise<boolean> {
  if (!openai) return evaluateRules(rules, ctx);
  const prompt = `Treasury state: ${JSON.stringify(ctx.treasury)}\nRules: ${JSON.stringify(rules)}\nShould the agent execute? Reply YES or NO only.`;
  const res = await openai.chat.completions.create({
    model: config.openai.model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 5,
  });
  return res.choices[0].message.content?.trim().toUpperCase() === 'YES';
}

async function runAgent(agent: Agent, eventPayload?: Record<string, unknown>): Promise<void> {
  const rules = agent.rules as unknown as RuleConfig[];
  const actions = agent.actions as unknown as ActionConfig[];
  const simulate = agent.simulate || config.agent.simulationMode;

  // Build context
  const accounts = await prisma.treasuryAccount.findMany({ take: 1 });
  const treasury: Record<string, string> = {};
  if (accounts[0]) {
    const balances = accounts[0].balances as { asset: string; balance: string }[];
    balances.forEach((b) => { treasury[b.asset] = b.balance; });
  }

  const ctx: AgentContext = { agentId: agent.id, treasury, eventPayload, timestamp: Date.now() };

  // Evaluate via plugin or default
  const plugin = agent.pluginId ? pluginRegistry.get(agent.pluginId) : undefined;
  const shouldExecute = plugin
    ? await plugin.evaluate(ctx, rules)
    : await llmDecide(ctx, rules);

  if (!shouldExecute) {
    await prisma.agentExecution.create({
      data: { agentId: agent.id, status: 'SKIPPED', simulated: simulate, triggeredBy: eventPayload ? 'event' : 'cron' },
    });
    return;
  }

  const resolvedActions = plugin ? await plugin.buildActions(ctx) : actions;

  if (simulate) {
    logger.info({ agentId: agent.id }, 'Agent simulation — no on-chain tx submitted');
    await prisma.agentExecution.create({
      data: { agentId: agent.id, status: 'SIMULATED', simulated: true, result: { actions: resolvedActions } as object },
    });
    return;
  }

  // Execute actions
  const results: unknown[] = [];
  for (const action of resolvedActions) {
    try {
      const result = await transactionService.execute(action);
      results.push(result);
    } catch (err) {
      logger.error({ agentId: agent.id, action, err }, 'Action failed');
      await prisma.agentExecution.create({
        data: { agentId: agent.id, status: 'FAILED', simulated: false, error: String(err) },
      });
      return;
    }
  }

  await prisma.agentExecution.create({
    data: { agentId: agent.id, status: 'SUCCESS', simulated: false, result: { results } as object },
  });
  await prisma.agent.update({ where: { id: agent.id }, data: { lastRunAt: new Date() } });
}

export const agentEngine = {
  async runById(agentId: string, eventPayload?: Record<string, unknown>) {
    const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
    if (agent.status !== 'ACTIVE') return;
    await runAgent(agent, eventPayload);
  },

  async runAll() {
    const agents = await prisma.agent.findMany({ where: { status: 'ACTIVE' } });
    await Promise.allSettled(agents.map((a) => runAgent(a)));
  },
};
