import { randomUUID, createHash } from 'node:crypto';
import { pool } from '../db.js';
import { ApiError } from '../middleware/error-handler.js';
import type { AgentResult, BacklogTask, Proposal, TraceEvent } from './schema.js';


export interface AgentRun {
  id: string; goal: string; mode: 'demo' | 'live';
  status: 'running' | 'pending_review' | 'approved' | 'rejected' | 'failed';
  proposal: Proposal | null; trace: TraceEvent[]; evidence: BacklogTask[];
  input_tokens: number; output_tokens: number; error: string | null;
  task_ids: number[]; selected_indices: number[]; created_at: string;
}
const fields = 'id, goal, mode, status, proposal, trace, evidence, input_tokens, output_tokens, error, task_ids, selected_indices, created_at';

export async function reserveRun(userId: number, goal: string, mode: string, requestId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize reservations per account across API processes, without an in-memory limiter.
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    await client.query(`UPDATE agent_runs SET status = 'failed', error = 'Run interrupted; create a new run to retry.', updated_at = NOW()
      WHERE user_id = $1 AND status = 'running' AND created_at < NOW() - INTERVAL '3 minutes'`, [userId]);
    const hash = createHash('sha256').update(JSON.stringify({ goal, mode })).digest('hex');
    const previous = await client.query(`SELECT ${fields}, input_hash FROM agent_runs WHERE user_id = $1 AND request_id = $2`, [userId, requestId]);
    if (previous.rowCount) {
      if (previous.rows[0].input_hash !== hash) throw new ApiError(409, 'Request ID was already used for a different goal');
      const { input_hash: _hash, ...run } = previous.rows[0];
      await client.query('COMMIT');
      return { run: run as AgentRun, created: false };
    }
    const active = await client.query("SELECT id FROM agent_runs WHERE user_id = $1 AND status = 'running'", [userId]);
    if (active.rowCount) throw new ApiError(409, 'A plan is already running. Open run history before retrying.');
    const count = await client.query("SELECT COUNT(*)::int AS count FROM agent_runs WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'", [userId]);
    if (count.rows[0].count >= 10) throw new ApiError(429, 'Limit of 10 plans per hour reached');
    const result = await client.query(`INSERT INTO agent_runs (id, user_id, request_id, input_hash, goal, mode, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'running') RETURNING ${fields}`, [randomUUID(), userId, requestId, hash, goal, mode]);
    await client.query('COMMIT');
    return { run: result.rows[0] as AgentRun, created: true };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function readBacklog(userId: number): Promise<BacklogTask[]> {
  const result = await pool.query(`SELECT id, title, LEFT(description, 600) AS description, completed FROM tasks
    WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 100`, [userId]);
  return result.rows;
}
export async function finishRun(userId: number, id: string, result: AgentResult, evidence: BacklogTask[]) {
  await pool.query(`UPDATE agent_runs SET status = 'pending_review', proposal = $3, trace = $4, evidence = $5,
    input_tokens = $6, output_tokens = $7, updated_at = NOW() WHERE id = $1 AND user_id = $2 AND status = 'running'`,
    [id, userId, JSON.stringify(result.proposal), JSON.stringify(result.trace), JSON.stringify(evidence), result.inputTokens, result.outputTokens]);
}
export async function failRun(userId: number, id: string, message: string, trace: TraceEvent[], inputTokens: number, outputTokens: number) {
  await pool.query(`UPDATE agent_runs SET status = 'failed', error = $3, trace = $4, input_tokens = $5, output_tokens = $6,
    updated_at = NOW() WHERE id = $1 AND user_id = $2 AND status = 'running'`, [id, userId, message, JSON.stringify(trace), inputTokens, outputTokens]);
}
export async function getRun(userId: number, id: string): Promise<AgentRun> {
  const result = await pool.query(`SELECT ${fields} FROM agent_runs WHERE id = $1 AND user_id = $2`, [id, userId]);
  if (!result.rowCount) throw new ApiError(404, 'Run not found');
  return result.rows[0];
}
export async function listRuns(userId: number): Promise<AgentRun[]> {
  const result = await pool.query(`SELECT ${fields} FROM agent_runs WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 20`, [userId]);
  return result.rows;
}
export async function decideRun(userId: number, id: string, action: 'approve' | 'reject', selected: number[]): Promise<AgentRun> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT ${fields} FROM agent_runs WHERE id = $1 AND user_id = $2 FOR UPDATE`, [id, userId]);
    if (!result.rowCount) throw new ApiError(404, 'Run not found');
    const run = result.rows[0] as AgentRun;
    const indices = [...new Set(selected)].sort((a, b) => a - b);
    if (run.status === 'approved' && action === 'approve' && JSON.stringify(indices) === JSON.stringify(run.selected_indices)) {
      await client.query('COMMIT'); return run;
    }
    if (run.status === 'rejected' && action === 'reject') { await client.query('COMMIT'); return run; }
    if (run.status !== 'pending_review' || !run.proposal) throw new ApiError(409, 'This run is no longer awaiting review');
    const ids: number[] = [];
    if (action === 'approve') {
      const tasks = run.proposal.tasks;
      if (!indices.length || indices.some(i => i < 0 || i >= tasks.length)) throw new ApiError(400, 'Select valid proposed tasks');
      if (indices.some(i => tasks[i].dependsOn.some(dep => !indices.includes(dep)))) throw new ApiError(400, 'Also select prerequisite tasks, or start a revised plan');
      const createdIds = new Map<number, number>();
      for (const i of indices) {
        const task = tasks[i];
        const prerequisites = task.dependsOn.map(dep => `#${createdIds.get(dep)}`).join(', ');
        const description = `${task.description}\n\nAcceptance criteria:\n${task.acceptanceCriteria.map(c => `- ${c}`).join('\n')}\n\n${prerequisites ? `Prerequisite tasks: ${prerequisites}\n` : ''}SprintPilot run: ${run.id}`;
        const inserted = await client.query('INSERT INTO tasks (user_id, title, description) VALUES ($1, $2, $3) RETURNING id', [userId, task.title, description]);
        ids.push(inserted.rows[0].id); createdIds.set(i, inserted.rows[0].id);
      }
    }
    const updated = await client.query(`UPDATE agent_runs SET status = $3, task_ids = $4, selected_indices = $5, updated_at = NOW()
      WHERE id = $1 AND user_id = $2 RETURNING ${fields}`, [id, userId, action === 'approve' ? 'approved' : 'rejected', ids, action === 'approve' ? indices : []]);
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
