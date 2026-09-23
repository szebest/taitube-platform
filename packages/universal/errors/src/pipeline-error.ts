import type { ErrorCode } from './error-codes.js';

export abstract class PipelineError extends Error {
  abstract readonly isRetryable: boolean;

  constructor(
    public readonly code: ErrorCode | string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PermanentError extends PipelineError {
  readonly isRetryable = false;

  constructor(
    public readonly code: ErrorCode | string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(code, message, details);
    this.name = 'PermanentError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TransientError extends PipelineError {
  readonly isRetryable = true;
}
