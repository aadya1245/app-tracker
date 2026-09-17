import { describe, expect, it, vi } from 'vitest';
import { DemoModel, runAgent, type Model, type ModelReply } from '../src/agent/engine.js';
import { validateProposal } from '../src/agent/schema.js';
import { AnthropicModel } from '../src/agent/provider.js';

const goal = 'Build search with pagination and access controls';
const backlog = [{ id: 4, title: 'Search index', description: 'Existing related work', completed: false }];
const read = { content: [{ type: 'tool_use', id: 'read', name: 'list_backlog', input: {} }], inputTokens: 10, outputTokens: 10 } as ModelReply;
const plan = { summary: 'Implement search', assumptions: ['Schema needs review'], tasks: [{ title: 'Search API', description: 'Implement filtering.', acceptanceCriteria: ['Only owned tasks are returned.'], dependsOn: [], relatedTaskIds: [4] }] };
function sequence(...replies: ModelReply[]): Model { let index = 0; return { respond: vi.fn(async () => replies[Math.min(index++, replies.length - 1)]) }; }
function submit(input: unknown): ModelReply { return { content: [{ type: 'tool_use', id: 'plan', name: 'propose_plan', input }], inputTokens: 10, outputTokens: 10 }; }

describe('agent behavior and safety contracts', () => {
  it('demo executes tools, validates dependencies, and declares its limitations', async () => {
    const result = await runAgent(goal, backlog, new DemoModel());
    expect(result.trace.map(t => t.tool)).toEqual(['list_backlog', 'propose_plan']);
    expect(result.proposal.tasks).toHaveLength(3);
    expect(result.proposal.assumptions[0]).toContain('not AI inference');
    expect(result.inputTokens + result.outputTokens).toBe(0);
  });
  it('accepts retrieved evidence and records provider usage', async () => {
    const result = await runAgent(goal, backlog, sequence(read, submit(plan)));
    expect(result.proposal.tasks[0].relatedTaskIds).toEqual([4]);
    expect(result.inputTokens).toBe(20);
  });
  it('repairs invalid evidence through tool feedback', async () => {
    const model = sequence(read, submit({ ...plan, tasks: [{ ...plan.tasks[0], relatedTaskIds: [999] }] }), submit(plan));
    const result = await runAgent(goal, backlog, model);
    expect(result.trace[1].detail).toContain('retrieved backlog');
    expect(result.proposal).toEqual(plan);
  });
  it('cannot propose a plan without first reading the backlog', async () => {
    await expect(runAgent(goal, backlog, sequence(submit(plan)))).rejects.toThrow('six model turns');
  });
  it('rejects loops and duplicate titles', () => {
    expect(() => validateProposal({ ...plan, tasks: [{ ...plan.tasks[0], dependsOn: [0] }] }, new Set([4]))).toThrow('earlier');
    expect(() => validateProposal({ ...plan, tasks: [plan.tasks[0], plan.tasks[0]] }, new Set([4]))).toThrow('unique');
  });
  it('stops a model that requests unauthorized tools', async () => {
    const model = sequence({ content: [{ type: 'tool_use', id: 'x', name: 'delete_all_tasks', input: {} }], inputTokens: 1, outputTokens: 1 });
    await expect(runAgent(goal, backlog, model)).rejects.toMatchObject({ trace: expect.arrayContaining([expect.objectContaining({ detail: expect.stringContaining('Unknown tool') })]) });
  });
  it('enforces token and tool budgets', async () => {
    await expect(runAgent(goal, backlog, sequence({ ...read, inputTokens: 30_001 }))).rejects.toThrow('Token budget');
    await expect(runAgent(goal, backlog, sequence({ ...read, content: Array.from({ length: 13 }, (_, i) => ({ type: 'tool_use', id: `${i}`, name: 'list_backlog', input: {} })) }))).rejects.toThrow('Tool call budget');
  });
  it('fails cleanly when a model returns prose without a plan', async () => {
    await expect(runAgent(goal, backlog, sequence({ content: [{ type: 'text', text: 'Maybe build something.' }], inputTokens: 1, outputTokens: 1 }))).rejects.toThrow('did not return a tool call');
  });
  it('searches the supplied snapshot and handles provider failures', async () => {
    const model = sequence(read, { content: [{ type: 'tool_use', id: 'search', name: 'search_backlog', input: { query: 'index' } }], inputTokens: 1, outputTokens: 1 }, submit(plan));
    expect((await runAgent(goal, backlog, model)).trace[1].detail).toContain('1 matching');
    await expect(runAgent(goal, backlog, { respond: async () => { throw new Error('Provider timeout'); } })).rejects.toThrow('Provider timeout');
  });
});

describe('live provider contract (mocked HTTP)', () => {
  it('sends tool definitions and forwards the cancellation signal', async () => {
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: read.content, usage: { input_tokens: 7, output_tokens: 8 } })));
    const signal = AbortSignal.timeout(1000);
    const reply = await new AnthropicModel('test-key', 'configured-model', transport).respond([{ role: 'user', content: goal }], signal);
    expect(reply.inputTokens).toBe(7);
    const options = transport.mock.calls[0][1];
    expect(options.signal).toBe(signal);
    expect(JSON.parse(options.body).tools).toHaveLength(3);
    expect(options.headers['x-api-key']).toBe('test-key');
  });
  it('does not expose upstream error bodies', async () => {
    const transport = vi.fn().mockResolvedValue(new Response('private provider details', { status: 429 }));
    await expect(new AnthropicModel('test-key', 'configured-model', transport).respond([], AbortSignal.timeout(1000))).rejects.toThrow('HTTP 429');
  });
  it('rejects malformed responses', async () => {
    const transport = vi.fn().mockResolvedValue(new Response('{"content": []}'));
    await expect(new AnthropicModel('test-key', 'configured-model', transport).respond([], AbortSignal.timeout(1000))).rejects.toThrow('unsupported response');
  });
});
