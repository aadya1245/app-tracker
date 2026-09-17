import { expect, test } from '@playwright/test';

// Browser contract tests use controlled API fixtures. Real SQL is exercised in api/tests.
test('review dependencies, approve a plan, and refresh backlog', async ({ page }) => {
  const proposal = { summary: 'A focused implementation plan.', assumptions: ['Confirm the API shape.'], tasks: [
    { title: 'Define contract', description: 'Document expected behavior.', acceptanceCriteria: ['Include a failure case.'], dependsOn: [], relatedTaskIds: [] },
    { title: 'Implement feature', description: 'Build the contract.', acceptanceCriteria: ['Tests pass.'], dependsOn: [0], relatedTaskIds: [] }
  ] };
  let run: any = null;
  let taskReads = 0;
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204 }); return; }
    let body: unknown;
    if (path.endsWith('/auth/login')) body = { token: 'browser-fixture', user: { id: 1, name: 'Demo builder', email: 'demo@example.com' } };
    else if (path.endsWith('/agent/config')) body = { liveAvailable: false };
    else if (path.includes('/tasks')) { taskReads++; body = { data: [], pagination: { page: 1, limit: 5, total: 0, totalPages: 1 } }; }
    else if (path.endsWith('/decision')) {
      expect(route.request().postDataJSON()).toEqual({ action: 'approve', selectedIndices: [1, 0] });
      run = { ...run, status: 'approved', task_ids: [10, 11] }; body = run;
    } else if (path.endsWith('/runs') && route.request().method() === 'POST') {
      run = { id: '8d7347e0-2c17-4c2b-8a56-d73edb51c9f0', goal: 'Build a search feature', mode: 'demo', status: 'pending_review', proposal, evidence: [], trace: [{ step: 1, tool: 'list_backlog', detail: 'Read 0 tasks', durationMs: 1 }], input_tokens: 0, output_tokens: 0, task_ids: [], selected_indices: [], error: null }; body = run;
    } else body = { data: run ? [run] : [] };
    await route.fulfill({ json: body });
  });
  await page.goto('/');
  await page.getByLabel('Email').fill('demo@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'From idea to implementation.' })).toBeVisible();
  await page.getByRole('button', { name: 'Create implementation plan' }).click();
  await expect(page.getByText('A focused implementation plan.')).toBeVisible();
  await page.getByRole('checkbox', { name: '1. Define contract' }).uncheck();
  await expect(page.getByRole('button', { name: 'Approve 1 tasks' })).toBeDisabled();
  await page.getByRole('checkbox', { name: '1. Define contract' }).check();
  await page.screenshot({ path: 'test-results/sprintpilot-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Approve 2 tasks' }).click();
  await expect(page.getByText('Added 2 tasks to your backlog.')).toBeVisible();
  await expect.poll(() => taskReads).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('button', { name: 'Approve 2 tasks' })).toHaveCount(0);
});
