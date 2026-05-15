import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { agentQueue } from '../queues/agent.queue';
import { walletAuth, requireRole } from '../middleware/auth';

const router = Router();

const AgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  rules: z.array(z.object({
    field: z.string(),
    operator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq', 'neq']),
    value: z.union([z.number(), z.string()]),
  })),
  triggers: z.array(z.object({
    type: z.enum(['cron', 'event', 'price']),
    cron: z.string().optional(),
    eventType: z.string().optional(),
  })),
  actions: z.array(z.object({
    type: z.enum(['payment', 'contract_call', 'swap', 'notify']),
    destination: z.string().optional(),
    amount: z.string().optional(),
    asset: z.string().optional(),
    contractId: z.string().optional(),
    functionName: z.string().optional(),
    params: z.array(z.unknown()).optional(),
  })),
  pluginId: z.string().optional(),
  simulate: z.boolean().optional(),
});

router.use(walletAuth);

router.get('/', async (req, res) => {
  const agents = await prisma.agent.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(agents);
});

router.post('/', requireRole('ADMIN', 'OPERATOR'), async (req, res) => {
  const parsed = AgentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = (req as typeof req & { user: { id: string } }).user;
  const agent = await prisma.agent.create({
    data: {
      ...parsed.data,
      rules: parsed.data.rules as object[],
      triggers: parsed.data.triggers as object[],
      actions: parsed.data.actions as object[],
      ownerId: user.id,
    },
  });
  res.status(201).json(agent);
});

router.get('/:id', async (req, res) => {
  const agent = await prisma.agent.findUnique({
    where: { id: req.params.id },
    include: { executions: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });
  if (!agent) return res.status(404).json({ error: 'Not found' });
  res.json(agent);
});

router.patch('/:id', requireRole('ADMIN', 'OPERATOR'), async (req, res) => {
  const agent = await prisma.agent.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(agent);
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  await prisma.agent.update({ where: { id: req.params.id }, data: { status: 'ARCHIVED' } });
  res.status(204).send();
});

// Manually trigger an agent run
router.post('/:id/run', requireRole('ADMIN', 'OPERATOR'), async (req, res) => {
  await agentQueue.add('run-agent', { agentId: req.params.id });
  res.json({ queued: true });
});

export default router;
