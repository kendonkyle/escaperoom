import { expect, test } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:4173/';

test.describe('Access flow', () => {
  test('accepts a valid manual code', async ({ page }) => {
    await page.goto(APP_URL);

    const status = page.getByTestId('status-primary');
    await expect(status).toHaveText(/Awaiting authentication/i);

    await page.getByTestId('manual-code-input').fill('ALLOWED-123');
    await page.getByTestId('manual-submit').click();

    await expect(status).toHaveText(/Access granted/i);
    await expect(page.getByTestId('status-secondary')).toHaveText(
      /ALLOWED-123/i,
    );
  });

  test('rejects an invalid code then resets', async ({ page }) => {
    await page.goto(APP_URL);

    const status = page.getByTestId('status-primary');
    await page.getByTestId('manual-code-input').fill('INVALID');
    await page.getByTestId('manual-submit').click();

    await expect(status).toHaveText(/Access denied/i);
    await expect(status).toHaveText(/Awaiting authentication/i, {
      timeout: 4000,
    });
  });
});

