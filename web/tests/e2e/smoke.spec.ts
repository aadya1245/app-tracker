import { expect, test } from '@playwright/test';

test('shows auth screen and allows mode switch', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Task Manager' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  await page.getByRole('button', { name: 'Switch to Register' }).click();
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
});
