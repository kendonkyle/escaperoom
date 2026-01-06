import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '@/app';

type FakeScannerCallback = (code: string) => void;

class MockScanner {
  public callback: FakeScannerCallback | null = null;
  public started = false;

  async start(callback: FakeScannerCallback) {
    this.started = true;
    this.callback = callback;
  }

  stop() {
    this.started = false;
  }

  trigger(code: string) {
    this.callback?.(code);
  }
}

describe('App UI integration', () => {
  const allowedCodes = ['ALLOWED-123'];
  const denyResetMs = 800;
  let root: HTMLElement;
  let scanner: MockScanner;

  beforeEach(() => {
    vi.useFakeTimers();
    root = document.createElement('div');
    root.id = 'app';
    document.body.innerHTML = '';
    document.body.appendChild(root);
    scanner = new MockScanner();
  });

  const getText = (testId: string) =>
    (document.querySelector(`[data-testid="${testId}"]`) as HTMLElement)
      ?.textContent ?? '';

  it('renders awaiting authentication by default', async () => {
    await initApp({
      root,
      allowedCodes,
      denyResetMs,
      scanner,
    });

    expect(getText('status-primary')).toMatch(/awaiting authentication/i);
    expect(scanner.started).toBe(true);
  });

  it('accepts a valid manual code', async () => {
    await initApp({
      root,
      allowedCodes,
      denyResetMs,
      scanner,
    });

    const input = document.querySelector(
      '[data-testid="manual-code-input"]',
    ) as HTMLInputElement;
    const submit = document.querySelector(
      '[data-testid="manual-submit"]',
    ) as HTMLButtonElement;

    input.value = 'ALLOWED-123';
    submit.click();

    expect(getText('status-primary')).toMatch(/access granted/i);
    expect(getText('status-secondary')).toMatch(/allowed-123/i);
  });

  it('denies and then resets for invalid manual input', async () => {
    await initApp({
      root,
      allowedCodes,
      denyResetMs,
      scanner,
    });

    const input = document.querySelector(
      '[data-testid="manual-code-input"]',
    ) as HTMLInputElement;
    const submit = document.querySelector(
      '[data-testid="manual-submit"]',
    ) as HTMLButtonElement;

    input.value = 'WRONG';
    submit.click();

    expect(getText('status-primary')).toMatch(/access denied/i);

    vi.advanceTimersByTime(denyResetMs + 1);

    expect(getText('status-primary')).toMatch(/awaiting authentication/i);
  });

  it('handles scanner callbacks like a valid scan', async () => {
    await initApp({
      root,
      allowedCodes,
      denyResetMs,
      scanner,
    });

    scanner.trigger('ALLOWED-123');

    expect(getText('status-primary')).toMatch(/access granted/i);
  });
});

