# SprintPilot: five-minute walkthrough

## Problem and scope

Turning a feature idea into small, testable tasks takes repeated checks against existing work. SprintPilot reads the signed-in user's backlog, proposes a dependency-ordered plan, and stores it for review. It cannot inspect your source code or implement the feature for you.

## Run it

Follow the root README's local setup. Register a throwaway local account and add a task titled **Search index** with a description of existing search behavior.

1. Ask: **Add search filters and pagination while preserving account isolation.**
2. Select **Demo template** to exercise the workflow without a key. Its fixed three-step plan is explicitly labeled and does not evaluate the backlog semantically.
3. Inspect assumptions, acceptance criteria, prerequisites, and the tool activity log.
4. Uncheck step 1 while leaving its dependent steps selected: approval is disabled.
5. Select all steps and approve. The new tasks appear in your backlog.
6. Reopen the saved plan from Recent plans. It remains approved and lists its original task IDs.

For actual model-generated planning, configure the server's Anthropic credentials as described in the README and choose **Live AI**. The agent may search the backlog, link related task IDs, and correct invalid tool arguments using validation feedback. Live inference has not been benchmarked; successful fixture tests are not evidence of model quality.

## A review conflict worth demonstrating

In live mode, create a plan that references the **Search index** task. Edit that task in the backlog before approving its related step. Approval returns a clear conflict and creates no tasks. Generate a fresh plan to review updated evidence. This check is deterministic application logic, independent of whether the model notices the edit.

The integration suite exercises this scenario without paying for inference:

```bash
npm run test:api
```

It covers changed titles, descriptions, completion state, deletion, ownership, independent selections, and replay after approval. It also tests transaction rollback and account isolation. PGlite checks SQL behavior, not contention between separate database connections.

## Code to explain in an interview

| Decision | Implementation | Tradeoff |
| --- | --- | --- |
| Model proposes; application writes | `api/src/agent/engine.ts`, `store.ts` | Human review adds a step but keeps task creation explicit. |
| Validate IDs and dependencies | `api/src/agent/schema.ts` | Grounded IDs and acyclic dependencies do not guarantee a useful plan. |
| Save plans and replay safely | `api/src/agent/store.ts` | Request IDs and row locks avoid duplicate approvals; synchronous inference still ties up a request. |
| Check evidence again at approval | `api/src/agent/store.ts` | Locks referenced rows through commit; does not detect new, semantically similar backlog tasks. |
| Keep inference bounded | `api/src/agent/engine.ts` | Turn, tool, time, and observed-token limits can stop complex requests early. |

The next meaningful evaluation is a small, manually reviewed collection of feature goals and backlogs: measure useful-task coverage, duplicate suggestions, grounded references, latency, and token usage. Report actual provider/model settings and failure cases before making accuracy or cost claims.
