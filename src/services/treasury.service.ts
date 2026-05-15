import * as StellarSdk from '@stellar/stellar-sdk';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { logger } from '../utils/logger';
import { config } from '../config';

const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);
const CACHE_TTL = 30; // seconds

export const treasuryService = {
  async syncAccount(walletAddress: string) {
    const account = await server.loadAccount(walletAddress);
    const balances = account.balances.map((b) => {
      if (b.asset_type === 'native') return { asset: 'XLM', balance: b.balance };
      if (b.asset_type === 'liquidity_pool_shares') return { asset: `LP:${b.liquidity_pool_id}`, balance: b.balance };
      return { asset: `${b.asset_code}:${b.asset_issuer}`, balance: b.balance };
    });

    const record = await prisma.treasuryAccount.upsert({
      where: { walletAddress },
      create: { walletAddress, balances, sequence: account.sequence, lastSyncedAt: new Date() },
      update: { balances, sequence: account.sequence, lastSyncedAt: new Date() },
    });

    await redis.setex(`treasury:${walletAddress}`, CACHE_TTL, JSON.stringify(balances));
    logger.info({ walletAddress, balances }, 'Treasury synced');
    return record;
  },

  async getBalances(walletAddress: string) {
    const cached = await redis.get(`treasury:${walletAddress}`);
    if (cached) return JSON.parse(cached);
    const account = await prisma.treasuryAccount.findUnique({ where: { walletAddress } });
    return account?.balances ?? [];
  },

  async listAccounts() {
    return prisma.treasuryAccount.findMany({ orderBy: { createdAt: 'desc' } });
  },

  async getTransactionHistory(walletAddress: string, limit = 20) {
    const records = await server.transactions().forAccount(walletAddress).limit(limit).call();
    return records.records.map((r) => ({
      hash: r.hash,
      ledger: r.ledger_attr,
      createdAt: r.created_at,
      operationCount: r.operation_count,
      feePaid: r.fee_charged,
    }));
  },
};
