import { Router } from 'express';
import { transactionService } from '../services/transaction.service';
import { walletAuth, requireRole } from '../middleware/auth';

const router = Router();
router.use(walletAuth);

router.get('/', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;
  const txs = await transactionService.list(limit, offset);
  res.json(txs);
});

router.get('/:hash', async (req, res) => {
  const tx = await transactionService.getStatus(req.params.hash);
  if (!tx) return res.status(404).json({ error: 'Not found' });
  res.json(tx);
});

// Manual transaction submission (admin only)
router.post('/', requireRole('ADMIN'), async (req, res) => {
  const result = await transactionService.execute(req.body);
  res.status(201).json(result);
});

export default router;
