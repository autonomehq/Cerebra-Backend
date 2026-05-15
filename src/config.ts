import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? '3000'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  stellar: {
    network: process.env.STELLAR_NETWORK ?? 'testnet',
    horizonUrl: process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
    rpcUrl: process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org',
    treasurySecretKey: process.env.TREASURY_SECRET_KEY ?? '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  },
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  agent: {
    pollIntervalMs: parseInt(process.env.AGENT_POLL_INTERVAL_MS ?? '30000'),
    simulationMode: process.env.SIMULATION_MODE === 'true',
  },
};
