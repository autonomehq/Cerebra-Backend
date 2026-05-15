import { agentQueue, treasuryQueue } from './agent.queue';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { config } from '../config';

export async function startScheduler() {
  // Periodic agent evaluation
  setInterval(async () => {
    await agentQueue.add('run-all', {}, { removeOnComplete: 10, removeOnFail: 5 });
    logger.debug('Scheduled agent run enqueued');
  }, config.agent.pollIntervalMs);

  // Periodic treasury sync for all tracked accounts
  setInterval(async () => {
    const accounts = await prisma.treasuryAccount.findMany({ select: { walletAddress: true } });
    for (const { walletAddress } of accounts) {
      await treasuryQueue.add('sync', { walletAddress }, { removeOnComplete: 5 });
    }
  }, 60_000);

  logger.info('Scheduler started');
}
