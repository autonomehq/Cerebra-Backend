import * as StellarSdk from '@stellar/stellar-sdk';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { agentQueue } from '../queues/agent.queue';
import { config } from '../config';
import { wsManager } from '../ws/manager';

const rpc = new StellarSdk.SorobanRpc.Server(config.stellar.rpcUrl);

let latestLedger = 0;

async function processEvents(contractId: string, startLedger: number) {
  const response = await rpc.getEvents({
    startLedger,
    filters: [{ type: 'contract', contractIds: [contractId] }],
  });

  for (const event of response.events) {
    const existing = await prisma.blockchainEvent.findFirst({
      where: { txHash: event.txHash, ledger: event.ledger },
    });
    if (existing) continue;

    const record = await prisma.blockchainEvent.create({
      data: {
        type: event.type,
        contractId,
        ledger: event.ledger,
        txHash: event.txHash,
        payload: event.value as object,
      },
    });

    logger.info({ eventId: record.id, type: event.type }, 'Blockchain event captured');
    wsManager.broadcast({ type: 'blockchain_event', data: record });

    // Trigger agents subscribed to this event type
    const agents = await prisma.agent.findMany({
      where: {
        status: 'ACTIVE',
        triggers: { path: ['$[*].eventType'], array_contains: event.type },
      },
    });

    for (const agent of agents) {
      await agentQueue.add('run-agent', {
        agentId: agent.id,
        eventPayload: { type: event.type, ledger: event.ledger, txHash: event.txHash },
      });
    }
  }

  return response.latestLedger;
}

export const eventListener = {
  async start(contractIds: string[]) {
    const info = await rpc.getLatestLedger();
    latestLedger = info.sequence - 1;
    logger.info({ contractIds, startLedger: latestLedger }, 'Event listener started');

    setInterval(async () => {
      for (const contractId of contractIds) {
        try {
          const latest = await processEvents(contractId, latestLedger);
          latestLedger = latest;
        } catch (err) {
          logger.error({ contractId, err }, 'Event polling error');
        }
      }
    }, 5000);
  },
};
