import { Router } from 'express';
import { treasuryService } from '../services/treasury.service';
import { treasuryQueue } from '../queues/agent.queue';
import { walletAuth, requireRole } from '../middleware/auth';

const router = Router();
router.use(walletAuth);

router.get('/', async (_req, res) => {
  const accounts = await treasuryService.listAccounts();
  res.json(accounts);
});

router.post('/track', requireRole('ADMIN', 'OPERATOR'), async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
  const account = await treasuryService.syncAccount(walletAddress);
  res.status(201).json(account);
});

router.get('/:address/balances', async (req, res) => {
  const balances = await treasuryService.getBalances(req.params.address);
  res.json(balances);
});

router.post('/:address/sync', requireRole('ADMIN', 'OPERATOR'), async (req, res) => {
  await treasuryQueue.add('sync', { walletAddress: req.params.address });
  res.json({ queued: true });
});

router.get('/:address/history', async (req, res) => {
  const history = await treasuryService.getTransactionHistory(req.params.address);
  res.json(history);
});

export default router;
