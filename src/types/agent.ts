export interface RuleConfig {
  field: string;       // e.g. "treasury.balance.XLM"
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq';
  value: number | string;
}

export interface TriggerConfig {
  type: 'cron' | 'event' | 'price';
  cron?: string;           // cron expression for time-based
  eventType?: string;      // blockchain event type
  priceAsset?: string;     // asset symbol for price trigger
  priceThreshold?: number;
}

export interface ActionConfig {
  type: 'payment' | 'contract_call' | 'swap' | 'notify';
  destination?: string;
  amount?: string;
  asset?: string;
  contractId?: string;
  functionName?: string;
  params?: unknown[];
}

export interface AgentContext {
  agentId: string;
  treasury: Record<string, string>; // asset -> balance
  eventPayload?: Record<string, unknown>;
  timestamp: number;
}

export interface AgentPlugin {
  id: string;
  evaluate(ctx: AgentContext, rules: RuleConfig[]): Promise<boolean>;
  buildActions(ctx: AgentContext): Promise<ActionConfig[]>;
}
