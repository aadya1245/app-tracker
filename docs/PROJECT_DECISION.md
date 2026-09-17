# Why SprintPilot

Research date: September 16, 2026. This is a scoped engineering recommendation for this existing repository, not a claim that one project guarantees a SWE interview.

| Candidate | What it demonstrates | Tradeoff here |
| --- | --- | --- |
| Autonomous issue fixer | Code execution, patching, test feedback | Needs sandbox isolation and a strong patch evaluation harness; substantially larger scope |
| General research assistant | Retrieval, citations, synthesis | Would start a separate product and leave this app's backend mostly unused |
| SprintPilot implementation planner | Tool use, bounded execution, authorization, persisted state, atomic approvals, tests | Directly extends the existing task manager; does not write or execute repository code |

SprintPilot is the selected first implementation because it solves a concrete task in this app and produces reviewable artifacts. It makes the existing full-stack application more useful while providing observable agent behavior. It is intentionally an original implementation, not a copied benchmark agent.

## Primary sources and decisions

- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent): its inspectable loop and recorded trajectory motivated a small explicit state machine. We do not claim its benchmark results, and we do not expose its unrestricted shell interface.
- [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents): start with simple composable patterns, clear tool contracts, and evaluation. Here, one tool-using agent is sufficient; orchestration is explicit TypeScript.
- [Anthropic tool definitions](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools): tools describe scope and return evidence; tool responses go back into the model context. The live adapter implements the Messages API and checks response structure.
- [Next.js security update](https://nextjs.org/blog/security-update-2025-12-11): the existing 14.2.25 dependency is updated to the documented 14.2.35 patch for that advisory. This is not a claim that all future advisories are covered.

## What to demonstrate in an interview

1. Why the model cannot write tasks: its tools only read a scoped backlog and propose a plan. The authenticated decision route owns writes.
2. How replay works: a unique account/request ID plus input hash prevents repeated model runs from client retries; a row lock and transaction make approval idempotent.
3. Why prompt instructions are insufficient: runtime validation checks evidence IDs and dependency order, and SQL queries enforce account isolation.
4. How partial failure is handled: all approved tasks and the run transition commit together or roll back together.
5. What the tests do and do not prove: deterministic tests exercise software contracts; they do not measure live model planning quality or promise hiring results.

## Live evaluation protocol (not yet measured)

Create a held-out dataset of at least 30 feature requests with backlog snapshots and human-written acceptance criteria. Compare a fixed template baseline with the live model on: valid-plan rate, evidence-ID correctness, duplicate-work rate, acceptance-criteria usefulness, tool turns, latency, and provider usage. Include ambiguous requests, prompt injection text inside tasks, conflicting requirements, and empty/large backlogs. Report counts and failure examples, not just a composite score. Save only consented, anonymized task data.

No production users, latency improvements, live model accuracy, or SWE-bench scores are claimed for SprintPilot.
