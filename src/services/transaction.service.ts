import * as StellarSdk from '@stellar/stellar-sdk';
import { Horizon } from '@stellar/stellar-sdk';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { ActionConfig } from '../types/agent';
import { config } from '../config';

const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);
const rpc = new StellarSdk.SorobanRpc.Server(config.stellar.rpcUrl);

function getKeypair(): StellarSdk.Keypair {
  return StellarSdk.Keypair.fromSecret(config.stellar.treasurySecretKey);
}

function getNetwork(): string {
  return config.stellar.network === 'mainnet'
    ? StellarSdk.Networks.PUBLIC
    : StellarSdk.Networks.TESTNET;
}

async function buildPayment(action: ActionConfig, sourceAccount: Horizon.AccountResponse) {
  const asset = action.asset === 'XLM'
    ? StellarSdk.Asset.native()
    : new StellarSdk.Asset(action.asset!.split(':')[0], action.asset!.split(':')[1]);

  return new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: getNetwork(),
  })
    .addOperation(StellarSdk.Operation.payment({
      destination: action.destination!,
      asset,
      amount: action.amount!,
    }))
    .setTimeout(30)
    .build();
}

async function buildContractCall(action: ActionConfig, sourceAccount: Horizon.AccountResponse) {
  const contract = new StellarSdk.Contract(action.contractId!);
  const args = (action.params ?? []).map((p) =>
    StellarSdk.nativeToScVal(p as StellarSdk.xdr.ScVal)
  );

  return new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: getNetwork(),
  })
    .addOperation(contract.call(action.functionName!, ...args))
    .setTimeout(30)
    .build();
}

export const transactionService = {
  async execute(action: ActionConfig): Promise<{ hash: string; ledger?: number }> {
    const keypair = getKeypair();
    const sourceAccount = await server.loadAccount(keypair.publicKey());

    let tx: StellarSdk.Transaction;
    if (action.type === 'payment') {
      tx = await buildPayment(action, sourceAccount);
    } else if (action.type === 'contract_call') {
      const preparedTx = await rpc.prepareTransaction(
        await buildContractCall(action, sourceAccount)
      );
      tx = preparedTx as StellarSdk.Transaction;
    } else {
      throw new Error(`Unsupported action type: ${action.type}`);
    }

    tx.sign(keypair);
    const result = await server.submitTransaction(tx);

    const record = await prisma.transaction.create({
      data: {
        hash: result.hash,
        type: action.type === 'payment' ? 'PAYMENT' : 'CONTRACT_CALL',
        status: 'SUBMITTED',
        fromAddress: keypair.publicKey(),
        toAddress: action.destination,
        amount: action.amount ? parseFloat(action.amount) : undefined,
        asset: action.asset,
        contractId: action.contractId,
        functionName: action.functionName,
        params: action.params ? { params: action.params } as object : undefined,
      },
    });

    logger.info({ hash: result.hash, txId: record.id }, 'Transaction submitted');
    return { hash: result.hash };
  },

  async getStatus(hash: string) {
    return prisma.transaction.findUnique({ where: { hash } });
  },

  async list(limit = 20, offset = 0) {
    return prisma.transaction.findMany({ orderBy: { createdAt: 'desc' }, take: limit, skip: offset });
  },
};
