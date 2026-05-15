import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger';
import agentsRouter from './routes/agents';
import treasuryRouter from './routes/treasury';
import transactionsRouter from './routes/transactions';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

  app.use('/agents', agentsRouter);
  app.use('/treasury', treasuryRouter);
  app.use('/transactions', transactionsRouter);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error(err);
    res.status(500).json({ error: err.message });
  });

  return app;
}
