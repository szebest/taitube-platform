export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  readonly failureThreshold: number;
  readonly cooldownMs: number;
  readonly now: () => number;
}

/**
 * Stops calling a dependency after `failureThreshold` failures in a row and lets a call through
 * again once `cooldownMs` has passed. That trial call decides: a success closes the circuit, a
 * failure opens it for another cooldown.
 */
export class CircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt: number | undefined;

  constructor(private readonly options: CircuitBreakerOptions) {}

  state(): CircuitState {
    if (this.openedAt === undefined) return 'closed';
    return this.options.now() - this.openedAt >= this.options.cooldownMs ? 'half-open' : 'open';
  }

  allows(): boolean {
    return this.state() !== 'open';
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = undefined;
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.state() === 'half-open' || this.consecutiveFailures >= this.options.failureThreshold) {
      this.openedAt = this.options.now();
    }
  }
}
