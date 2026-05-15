import http from 'http';
import { WebSocketServer } from 'ws';
import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { wsManager } from './ws/manager';
import { startWorkers } from './queues/workers';
import { startScheduler } from './queues/scheduler';
import { prisma } from './lib/prisma';

// Load plugins
import './plugins/rebalance.plugin';

async function main() {
  await prisma.$connect();
  logger.info('Database connected');

  const app = createApp();
  const server = http.createServer(app);

  const wss = new WebSocketServer({ server, path: '/ws' });
  wsManager.attach(wss);

  startWorkers();
  await startScheduler();

  server.listen(config.port, () => {
    logger.info({ port: config.port }, 'Cerebra backend running');
  });

  const shutdown = async () => {
    logger.info('Shutting down...');
    await prisma.$disconnect();
    server.close(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error(err, 'Fatal startup error');
  process.exit(1);
});
