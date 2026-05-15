import { Request, Response, NextFunction } from 'express';
import nacl from 'tweetnacl';
import { prisma } from '../lib/prisma';
import { Role } from '@prisma/client';

// Wallet signature auth: client signs a challenge with their Stellar keypair
// Header: X-Wallet-Address, X-Signature (hex of signed "cerebra-auth:<timestamp>")
export async function walletAuth(req: Request, res: Response, next: NextFunction) {
  const walletAddress = req.headers['x-wallet-address'] as string;
  const signature = req.headers['x-signature'] as string;
  const timestamp = req.headers['x-timestamp'] as string;

  if (!walletAddress || !signature || !timestamp) {
    return res.status(401).json({ error: 'Missing auth headers' });
  }

  // Reject stale timestamps (5 min window)
  if (Math.abs(Date.now() - parseInt(timestamp)) > 300_000) {
    return res.status(401).json({ error: 'Timestamp expired' });
  }

  try {
    const message = Buffer.from(`cerebra-auth:${timestamp}`);
    const sig = Buffer.from(signature, 'hex');
    // Stellar public key is base32; decode to raw bytes via StrKey
    const { StrKey } = await import('@stellar/stellar-sdk');
    const pubKeyBytes = StrKey.decodeEd25519PublicKey(walletAddress);
    const valid = nacl.sign.detached.verify(message, sig, pubKeyBytes);
    if (!valid) return res.status(401).json({ error: 'Invalid signature' });
  } catch {
    return res.status(401).json({ error: 'Signature verification failed' });
  }

  // Upsert user
  const user = await prisma.user.upsert({
    where: { walletAddress },
    create: { walletAddress },
    update: {},
  });

  (req as Request & { user: typeof user }).user = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user: { role: Role } }).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
