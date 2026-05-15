import { AgentPlugin, AgentContext, RuleConfig, ActionConfig } from '../types/agent';
import { pluginRegistry } from './registry';

// Example plugin: auto-rebalance treasury when XLM drops below threshold
const rebalancePlugin: AgentPlugin = {
  id: 'rebalance',

  async evaluate(ctx: AgentContext, rules: RuleConfig[]): Promise<boolean> {
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
      }
    });
  },

  async buildActions(ctx: AgentContext): Promise<ActionConfig[]> {
    // Placeholder: swap USDC -> XLM to rebalance
    return [{
      type: 'swap',
      asset: 'USDC',
      amount: '100',
      destination: 'XLM',
    }];
  },
};

pluginRegistry.register(rebalancePlugin);
