import { AgentPlugin } from '../types/agent';

const plugins = new Map<string, AgentPlugin>();

export const pluginRegistry = {
  register(plugin: AgentPlugin) {
    plugins.set(plugin.id, plugin);
  },
  get(id: string): AgentPlugin | undefined {
    return plugins.get(id);
  },
  list(): string[] {
    return Array.from(plugins.keys());
  },
};
