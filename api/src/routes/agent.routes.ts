import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error-handler.js';
import { runInput } from '../agent/schema.js';
import { AgentFailure, DemoModel, runAgent } from '../agent/engine.js';
import { AnthropicModel } from '../agent/provider.js';
import { decideRun, failRun, finishRun, getRun, listRuns, readBacklog, reserveRun } from '../agent/store.js';

export const agentRouter = Router();
agentRouter.use(requireAuth);
agentRouter.get('/config', (_req, res) => res.json({ liveAvailable: Boolean(env.ANTHROPIC_API_KEY && env.ANTHROPIC_MODEL) }));
agentRouter.get('/runs', async (req, res) => res.json({ data: await listRuns(req.user!.userId) }));
agentRouter.get('/runs/:id', async (req, res) => res.json(await getRun(req.user!.userId, z.string().uuid().parse(req.params.id))));
agentRouter.post('/runs', async (req, res) => {
  const { goal, mode, requestId } = runInput.parse(req.body);
  const userId = req.user!.userId;
  if (mode === 'live' && (!env.ANTHROPIC_API_KEY || !env.ANTHROPIC_MODEL)) throw new ApiError(503, 'Live AI needs ANTHROPIC_API_KEY and ANTHROPIC_MODEL configured on the server. Demo mode is available.');
  const reservation = await reserveRun(userId, goal, mode, requestId);
  if (!reservation.created) { res.status(reservation.run.status === 'running' ? 202 : 200).json(reservation.run); return; }
  const id = reservation.run.id;
  try {
    const backlog = await readBacklog(userId);
    const model = mode === 'live' ? new AnthropicModel(env.ANTHROPIC_API_KEY!, env.ANTHROPIC_MODEL!) : new DemoModel();
    const result = await runAgent(goal, backlog, model);
    await finishRun(userId, id, result, backlog);
  } catch (error) {
    const failure = error instanceof AgentFailure ? error : new AgentFailure('Could not complete the plan. Retry with a new run.', []);
    await failRun(userId, id, failure.message, failure.trace, failure.inputTokens, failure.outputTokens);
  }
  res.status(201).json(await getRun(userId, id));
});
agentRouter.post('/runs/:id/decision', async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const { action, selectedIndices } = z.object({ action: z.enum(['approve', 'reject']), selectedIndices: z.array(z.number().int().min(0).max(7)).max(8).default([]) }).strict().parse(req.body);
  res.json(await decideRun(req.user!.userId, id, action, selectedIndices));
});
