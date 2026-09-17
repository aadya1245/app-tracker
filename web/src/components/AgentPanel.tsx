'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { agentConfig, fetchAgentRuns, startAgentRun, decideAgentRun, type AgentRun } from '@/lib/api';

export function AgentPanel({ token, onApproved }: { token: string; onApproved: () => void }) {
  const [goal, setGoal] = useState('Add a search feature to my task manager with filtering, pagination, and tests.');
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<{ goal: string; mode: string; id: string } | null>(null);

  const refresh = useCallback(async () => { const result = await fetchAgentRuns(token); setRuns(result.data); return result.data; }, [token]);
  useEffect(() => {
    void agentConfig(token).then(config => setLiveAvailable(config.liveAvailable)).catch(() => setLiveAvailable(false));
    void refresh().catch(e => setError(e.message));
  }, [token, refresh]);

  function open(next: AgentRun) { setRun(next); setSelected(next.proposal?.tasks.map((_, i) => i) ?? []); }
  async function generate() {
    setBusy(true); setError(''); setRun(null);
    if (!request.current || request.current.goal !== goal || request.current.mode !== mode) request.current = { goal, mode, id: crypto.randomUUID() };
    try {
      const next = await startAgentRun(token, { goal, mode, requestId: request.current.id });
      open(next);
      if (next.status !== 'running') request.current = null;
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create plan'); }
    finally { setBusy(false); }
  }
  async function decide(action: 'approve' | 'reject') {
    if (!run) return;
    setBusy(true); setError('');
    try {
      const next = await decideAgentRun(token, run.id, action, selected);
      setRun(next); await refresh();
      if (action === 'approve') onApproved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save decision'); }
    finally { setBusy(false); }
  }
  const dependencyMissing = selected.some(index => run?.proposal?.tasks[index].dependsOn.some(dep => !selected.includes(dep)));

  return <section className="card agent-card" aria-labelledby="agent-title">
    <div className="agent-heading"><div><span className="eyebrow">PLAN YOUR NEXT BUILD</span><h2 id="agent-title">From idea to implementation.</h2></div><span className="badge">SprintPilot agent</span></div>
    <p className="muted">Describe a feature. Review a plan informed by your backlog, then add the tasks you want to build.</p>
    <form className="grid" onSubmit={e => { e.preventDefault(); void generate(); }}>
      <label htmlFor="agent-goal">What do you want to build?</label>
      <textarea id="agent-goal" value={goal} onChange={e => setGoal(e.target.value)} rows={3} minLength={12} maxLength={4000} required disabled={busy} />
      <div className="agent-controls"><label>Planning mode <select value={mode} onChange={e => setMode(e.target.value as 'demo' | 'live')} disabled={busy}><option value="demo">Demo template · no API key</option><option value="live" disabled={!liveAvailable}>Live AI{!liveAvailable ? ' · server setup needed' : ''}</option></select></label><button disabled={busy || goal.trim().length < 12}>{busy ? 'Working…' : 'Create implementation plan →'}</button></div>
      <small>{mode === 'demo' ? 'Demo uses a fixed template to demonstrate the full workflow. It is not AI inference.' : 'Your feature request and up to 100 backlog tasks will be sent to the configured AI provider.'}</small>
    </form>
    {busy && <p role="status">Working on your request. A live plan can take up to 90 seconds.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {run && <div className="plan-result" aria-live="polite">
      <div className="agent-heading"><h3>Your implementation plan</h3><span className="badge">{run.mode} · {run.status.replace('_', ' ')}</span></div>
      {run.status === 'running' && <p>This run is still processing. Refresh history and reopen it to check the result.</p>}
      {run.error && <p className="error" role="alert">{run.error}</p>}
      {run.proposal && <>
        <p>{run.proposal.summary}</p>
        {!!run.proposal.assumptions.length && <details open><summary>Assumptions to check</summary><ul>{run.proposal.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></details>}
        <ol className="proposed-tasks">{run.proposal.tasks.map((task, i) => <li key={i}>
          <label className="task-choice"><input type="checkbox" checked={selected.includes(i)} disabled={run.status !== 'pending_review' || busy} onChange={e => setSelected(current => e.target.checked ? [...current, i] : current.filter(n => n !== i))} /><strong>{i + 1}. {task.title}</strong></label>
          <p>{task.description}</p><ul>{task.acceptanceCriteria.map((criterion, c) => <li key={c}>{criterion}</li>)}</ul>
          {!!task.dependsOn.length && <small>Build after: {task.dependsOn.map(n => `step ${n + 1}`).join(', ')}</small>}
          {!!task.relatedTaskIds.length && <p className="evidence">Related backlog: {task.relatedTaskIds.map(id => `#${id} ${run.evidence.find(t => t.id === id)?.title ?? ''}`).join(' · ')}. Check for overlap before approval.</p>}
        </li>)}</ol>
        {run.status === 'pending_review' && <><div className="actions"><button disabled={busy || !selected.length || dependencyMissing} onClick={() => void decide('approve')}>Approve {selected.length} tasks</button><button className="secondary" disabled={busy} onClick={() => void decide('reject')}>Discard plan</button></div>{dependencyMissing && <p role="status">Select the prerequisite steps too before approving.</p>}<small>Approval adds selected tasks to your backlog. Nothing is created before you approve.</small></>}
        {run.status === 'approved' && <p role="status">Added {run.task_ids.length} tasks to your backlog.</p>}
        {run.status === 'rejected' && <p>Plan discarded. Your backlog was not changed.</p>}
      </>}
      {!!run.trace.length && <details className="trace"><summary>Activity · {run.trace.length} tool calls · {run.input_tokens + run.output_tokens} tokens</summary><ol>{run.trace.map((event, i) => <li key={i}><strong>{event.tool}</strong> · {event.detail}</li>)}</ol></details>}
    </div>}
    <details className="history"><summary>Recent plans ({runs.length})</summary><button className="secondary" disabled={busy} onClick={() => void refresh().catch(e => setError(e.message))}>Refresh history</button><ul>{runs.map(item => <li key={item.id}><button className="history-item" disabled={busy} onClick={() => open(item)}>{item.goal}<small>{item.mode} · {item.status.replace('_', ' ')}</small></button></li>)}</ul>{!runs.length && <p>No plans yet. Start with a feature request above.</p>}</details>
  </section>;
}
