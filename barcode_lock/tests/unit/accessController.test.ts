import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AccessController, AccessState } from '@/stateMachine';

describe('AccessController', () => {
  const allowedCodes = ['OPEN-SESAME', '123456'];
  const denyResetMs = 1200;
  let controller: AccessController;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new AccessController({
      allowedCodes,
      denyResetMs,
    });
  });

  it('starts in awaiting state', () => {
    expect(controller.state).toBe<AccessState>('awaiting');
  });

  it('grants access when a valid code is provided', () => {
    const listener = vi.fn();
    controller.onStateChange(listener);

    const state = controller.handleCode('open-sesame');

    expect(state).toBe<AccessState>('granted');
    expect(controller.state).toBe<AccessState>('granted');
    expect(listener).toHaveBeenCalledWith('granted', 'open-sesame');
  });

  it('denies access and schedules reset for invalid codes', () => {
    const listener = vi.fn();
    controller.onStateChange(listener);

    controller.handleCode('bad-code');

    expect(controller.state).toBe<AccessState>('denied');
    expect(listener).toHaveBeenCalledWith('denied', 'bad-code');

    vi.advanceTimersByTime(denyResetMs + 1);

    expect(controller.state).toBe<AccessState>('awaiting');
    expect(listener).toHaveBeenLastCalledWith('awaiting', null);
  });

  it('ignores empty or whitespace-only codes', () => {
    const listener = vi.fn();
    controller.onStateChange(listener);

    controller.handleCode('   ');

    expect(controller.state).toBe<AccessState>('awaiting');
    expect(listener).not.toHaveBeenCalled();
  });

  it('resets immediately when requested', () => {
    controller.handleCode('bad-code');
    expect(controller.state).toBe<AccessState>('denied');

    controller.reset();

    expect(controller.state).toBe<AccessState>('awaiting');
  });
});

