export const agentSchemaSql = `
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  input_hash TEXT NOT NULL,
  goal TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('demo', 'live')),
  status TEXT NOT NULL CHECK (status IN ('running', 'pending_review', 'approved', 'rejected', 'failed')),
  proposal JSONB,
  trace JSONB NOT NULL DEFAULT '[]',
  evidence JSONB NOT NULL DEFAULT '[]',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  task_ids INTEGER[] NOT NULL DEFAULT '{}',
  selected_indices INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, request_id)
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user_created ON agent_runs(user_id, created_at DESC);
`;

