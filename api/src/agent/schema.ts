import { z } from 'zod';

export const runInput = z.object({
  goal: z.string().trim().min(12).max(4000),
  mode: z.enum(['demo', 'live']).default('demo'),
  requestId: z.string().uuid()
}).strict();

export const proposalSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  assumptions: z.array(z.string().trim().min(1).max(300)).max(8),
  tasks: z.array(z.object({
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().min(1).max(2000),
    acceptanceCriteria: z.array(z.string().trim().min(1).max(300)).min(1).max(6),
    dependsOn: z.array(z.number().int().min(0)).max(7),
    relatedTaskIds: z.array(z.number().int().positive()).max(10)
  }).strict()).min(1).max(8)
}).strict();

export type Proposal = z.infer<typeof proposalSchema>;
export interface BacklogTask { id: number; title: string; description: string | null; completed: boolean }
export interface TraceEvent { step: number; tool: string; detail: string; durationMs: number }
export interface AgentResult { proposal: Proposal; trace: TraceEvent[]; inputTokens: number; outputTokens: number }

export function validateProposal(value: unknown, knownIds: Set<number>): Proposal {
  const proposal = proposalSchema.parse(value);
  const titles = new Set<string>();
  proposal.tasks.forEach((task, index) => {
    const title = task.title.toLowerCase();
    if (titles.has(title)) throw new Error('Proposed task titles must be unique');
    titles.add(title);
    if (task.dependsOn.some(id => id >= index)) throw new Error('Dependencies must refer to earlier task indices');
    if (task.relatedTaskIds.some(id => !knownIds.has(id))) throw new Error('Related task IDs must come from retrieved backlog evidence');
  });
  return proposal;
}
