import { Worker } from 'bullmq';
import { redis } from '../lib/redis';
import { agentEngine } from '../services/agent.engine';
import { treasuryService } from '../services/treasury.service';
import { logger } from '../utils/logger';

export function startWorkers() {
  const agentWorker = new Worker(
    'agents',
    async (job) => {
      if (job.name === 'run-agent') {
        await agentEngine.runById(job.data.agentId, job.data.eventPayload);
      } else if (job.name === 'run-all') {
        await agentEngine.runAll();
      }
    },
    { connection: redis, concurrency: 5 }
  );

  const treasuryWorker = new Worker(
    'treasury',
    async (job) => {
      if (job.name === 'sync') {
        await treasuryService.syncAccount(job.data.walletAddress);
      }
    },
    { connection: redis, concurrency: 3 }
  );

  agentWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Agent job failed'));
  treasuryWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Treasury job failed'));

  logger.info('BullMQ workers started');
}
