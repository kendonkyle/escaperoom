export type AccessState = 'awaiting' | 'granted' | 'denied';

export interface AccessControllerOptions {
  allowedCodes: string[];
  denyResetMs?: number;
}

type StateListener = (state: AccessState, code: string | null) => void;

const DEFAULT_DENY_RESET_MS = 2000;

export class AccessController {
  public state: AccessState = 'awaiting';

  private readonly allowedSet: Set<string>;
  private readonly denyResetMs: number;
  private listeners: StateListener[] = [];
  private resetTimer: number | null = null;

  constructor(options: AccessControllerOptions) {
    this.allowedSet = new Set(
      options.allowedCodes.map((code) => this.normalize(code)),
    );
    this.denyResetMs = options.denyResetMs ?? DEFAULT_DENY_RESET_MS;
  }

  handleCode(rawCode: string): AccessState {
    const normalized = this.normalize(rawCode);
    if (!normalized) return this.state;

    this.clearReset();

    if (this.allowedSet.has(normalized)) {
      this.updateState('granted', normalized);
      return this.state;
    }

    this.updateState('denied', normalized);
    this.resetTimer = window.setTimeout(() => {
      this.updateState('awaiting', null);
    }, this.denyResetMs);

    return this.state;
  }

  reset(): AccessState {
    this.clearReset();
    this.updateState('awaiting', null);
    return this.state;
  }

  onStateChange(listener: StateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((entry) => entry !== listener);
    };
  }

  private normalize(code: string): string {
    return code.trim().toLowerCase();
  }

  private updateState(state: AccessState, code: string | null) {
    this.state = state;
    this.listeners.forEach((listener) => listener(state, code));
  }

  private clearReset() {
    if (this.resetTimer !== null) {
      window.clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }
}

