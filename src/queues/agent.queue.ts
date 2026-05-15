import { Queue } from 'bullmq';
import { redis } from '../lib/redis';

export const agentQueue = new Queue('agents', { connection: redis });
export const treasuryQueue = new Queue('treasury', { connection: redis });
