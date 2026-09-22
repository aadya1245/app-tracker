import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: null as unknown as PGlite }));
vi.mock('../src/db.js', () => {
  const query = async (sql: string, params?: unknown[]) => {
    const result = await state.db.query(sql, params);
    return { rows: result.rows, rowCount: result.affectedRows || result.rows.length };
  };
  return { pool: { query, connect: async () => ({ query, release() {} }) } };
});
import { app } from '../src/app.js';
import { signToken } from '../src/utils/jwt.js';
import { agentSchemaSql } from '../src/agent/db-schema.js';
import { decideRun, finishRun, getRun, reserveRun } from '../src/agent/store.js';

const token = signToken({ userId: 1, email: 'one@example.com' });
const otherToken = signToken({ userId: 2, email: 'two@example.com' });
const authorization = `Bearer ${token}`;
const payload = () => ({ goal: 'Add search with authorization and pagination', mode: 'demo', requestId: randomUUID() });
async function create(body = payload()) { return request(app).post('/api/v1/agent/runs').set('Authorization', authorization).send(body); }

beforeAll(async () => {
  state.db = new PGlite();
  await state.db.exec(`CREATE TABLE users (id SERIAL PRIMARY KEY); INSERT INTO users VALUES (1), (2);
    CREATE TABLE tasks (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), title VARCHAR(180), description TEXT, completed BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW());`);
  await state.db.exec(agentSchemaSql);
}, 30_000);
beforeEach(async () => { await state.db.exec('DELETE FROM agent_runs; DELETE FROM tasks;'); });
afterAll(async () => { await state.db.close(); });

describe('agent API and PostgreSQL persistence (PGlite)', () => {
  async function evidencedPlan() {
    const inserted = await state.db.query<{ id: number }>("INSERT INTO tasks (user_id, title, description) VALUES (1, 'Search index', 'Existing search implementation') RETURNING id");
    const id = inserted.rows[0].id;
    const { run } = await reserveRun(1, payload().goal, 'demo', randomUUID());
    await finishRun(1, run.id, {
      proposal: { summary: 'Extend search', assumptions: [], tasks: [
        { title: 'Add search pagination', description: 'Extend existing index', acceptanceCriteria: ['Page two contains distinct results'], dependsOn: [], relatedTaskIds: [id] },
        { title: 'Document onboarding', description: 'Independent documentation', acceptanceCriteria: ['Setup commands are documented'], dependsOn: [], relatedTaskIds: [] }
      ] }, trace: [], inputTokens: 0, outputTokens: 0
    }, [{ id, title: 'Search index', description: 'Existing search implementation', completed: false }]);
    return { runId: run.id, taskId: id };
  }
  it.each(['title', 'description', 'completed', 'deleted'])('blocks approval when referenced evidence is %s', async field => {
    const { runId, taskId } = await evidencedPlan();
    const mutations: Record<string, string> = {
      title: "UPDATE tasks SET title = 'Different work' WHERE id = $1",
      description: "UPDATE tasks SET description = 'Changed scope' WHERE id = $1",
      completed: 'UPDATE tasks SET completed = TRUE WHERE id = $1',
      deleted: 'DELETE FROM tasks WHERE id = $1'
    };
    await state.db.query(mutations[field], [taskId]);
    const response = await request(app).post(`/api/v1/agent/runs/${runId}/decision`)
      .set('Authorization', authorization).send({ action: 'approve', selectedIndices: [0, 1] });
    expect(response.status).toBe(409);
    expect((await getRun(1, runId)).status).toBe('pending_review');
    expect((await state.db.query("SELECT * FROM tasks WHERE title IN ('Add search pagination', 'Document onboarding')")).rows).toHaveLength(0);
  });
  it('approves unchanged evidence and keeps retries idempotent after later edits', async () => {
    const { runId, taskId } = await evidencedPlan();
    const approved = await decideRun(1, runId, 'approve', [0]);
    await state.db.query('DELETE FROM tasks WHERE id = $1', [taskId]);
    expect((await decideRun(1, runId, 'approve', [0])).task_ids).toEqual(approved.task_ids);
  });
  it('allows an independent subset or rejection after evidence changes', async () => {
    const first = await evidencedPlan();
    await state.db.query('DELETE FROM tasks WHERE id = $1', [first.taskId]);
    expect((await decideRun(1, first.runId, 'approve', [1])).task_ids).toHaveLength(1);
    const second = await evidencedPlan();
    await state.db.query('DELETE FROM tasks WHERE id = $1', [second.taskId]);
    expect((await decideRun(1, second.runId, 'reject', [])).status).toBe('rejected');
  });
  it('does not accept evidence belonging to another account', async () => {
    const { runId, taskId } = await evidencedPlan();
    await state.db.query('UPDATE tasks SET user_id = 2 WHERE id = $1', [taskId]);
    await expect(decideRun(1, runId, 'approve', [0])).rejects.toMatchObject({ statusCode: 409 });
  });
  it('requires authentication and validates payloads', async () => {
    expect((await request(app).post('/api/v1/agent/runs').send(payload())).status).toBe(401);
    expect((await create({ ...payload(), goal: 'short' })).status).toBe(400);
    expect((await request(app).get('/api/v1/agent/runs/not-a-uuid').set('Authorization', authorization)).status).toBe(400);
  });
  it('creates a reviewable plan without creating tasks; approval is idempotent', async () => {
    const response = await create();
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('pending_review');
    expect((await state.db.query('SELECT * FROM tasks')).rows).toHaveLength(0);
    const run = response.body;
    const approved = await decideRun(1, run.id, 'approve', [0, 1, 2]);
    expect(approved.task_ids).toHaveLength(3);
    const replay = await decideRun(1, run.id, 'approve', [2, 1, 0]);
    expect(replay.task_ids).toEqual(approved.task_ids);
    expect((await state.db.query('SELECT * FROM tasks')).rows).toHaveLength(3);
    await expect(decideRun(1, run.id, 'approve', [0])).rejects.toMatchObject({ statusCode: 409 });
  });
  it('does not disclose or approve another user’s run', async () => {
    const run = (await create()).body;
    const other = { Authorization: `Bearer ${otherToken}` };
    expect((await request(app).get(`/api/v1/agent/runs/${run.id}`).set(other)).status).toBe(404);
    expect((await request(app).post(`/api/v1/agent/runs/${run.id}/decision`).set(other).send({ action: 'approve', selectedIndices: [0] })).status).toBe(404);
    expect((await request(app).get('/api/v1/agent/runs').set(other)).body.data).toHaveLength(0);
  });
  it('retrieves only owned tasks and bounds evidence descriptions', async () => {
    await state.db.query('INSERT INTO tasks (user_id, title, description) VALUES (1, $1, $2), (2, $3, $4)', ['Owned task', 'x'.repeat(1000), 'Other user secret', 'Private']);
    const run = (await create()).body;
    expect(run.evidence).toHaveLength(1);
    expect(run.evidence[0].title).toBe('Owned task');
    expect(run.evidence[0].description).toHaveLength(600);
  });
  it('replays the same request but refuses reusing its key for different input', async () => {
    const body = payload();
    const first = await create(body);
    const second = await create(body);
    expect(second.status).toBe(200); expect(second.body.id).toBe(first.body.id);
    expect((await create({ ...body, goal: 'A completely different feature request' })).status).toBe(409);
  });
  it('rejects invalid dependencies and allows approving a valid subset', async () => {
    const run = (await create()).body;
    await expect(decideRun(1, run.id, 'approve', [2])).rejects.toMatchObject({ statusCode: 400 });
    await expect(decideRun(1, run.id, 'approve', [7])).rejects.toMatchObject({ statusCode: 400 });
    const approved = await decideRun(1, run.id, 'approve', [0]);
    expect(approved.task_ids).toHaveLength(1);
  });
  it('rejects a plan without changing the backlog', async () => {
    const run = (await create()).body;
    expect((await decideRun(1, run.id, 'reject', [])).status).toBe('rejected');
    expect((await decideRun(1, run.id, 'reject', [])).status).toBe('rejected');
    await expect(decideRun(1, run.id, 'approve', [0])).rejects.toMatchObject({ statusCode: 409 });
    expect((await state.db.query('SELECT * FROM tasks')).rows).toHaveLength(0);
  });
  it('rolls back all task writes if an insert fails', async () => {
    const run = (await create()).body;
    await state.db.exec("ALTER TABLE tasks ADD CONSTRAINT forced_failure CHECK (title <> 'Implement the smallest complete feature')");
    try {
      await expect(decideRun(1, run.id, 'approve', [0, 1, 2])).rejects.toThrow();
      expect((await state.db.query('SELECT * FROM tasks')).rows).toHaveLength(0);
      expect((await getRun(1, run.id)).status).toBe('pending_review');
    } finally { await state.db.exec('ALTER TABLE tasks DROP CONSTRAINT forced_failure'); }
  });
  it('caps active runs and recovers a stale reservation', async () => {
    const first = await reserveRun(1, payload().goal, 'demo', randomUUID());
    await expect(reserveRun(1, payload().goal, 'demo', randomUUID())).rejects.toMatchObject({ statusCode: 409 });
    await state.db.query("UPDATE agent_runs SET created_at = NOW() - INTERVAL '4 minutes' WHERE id = $1", [first.run.id]);
    expect((await reserveRun(1, payload().goal, 'demo', randomUUID())).created).toBe(true);
    expect((await getRun(1, first.run.id)).status).toBe('failed');
  });
  it('limits an account to ten runs per hour', async () => {
    for (let i = 0; i < 10; i++) expect((await create()).status).toBe(201);
    expect((await create()).status).toBe(429);
  });
  it('reports live configuration honestly', async () => {
    expect((await request(app).get('/api/v1/agent/config').set('Authorization', authorization)).body.liveAvailable).toBe(false);
    expect((await create({ ...payload(), mode: 'live' })).status).toBe(503);
  });
});
