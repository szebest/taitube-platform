import { type ApiErrorCode, ApiErrorCodes } from './api-error-codes';
import { type PipelineErrorCode, PipelineErrorCodes } from './pipeline-error-codes';

export * from './api-error-codes';
export * from './pipeline-error-codes';

export const ErrorCodes = { ...ApiErrorCodes, ...PipelineErrorCodes } as const;

export type ErrorCode = ApiErrorCode | PipelineErrorCode;

export interface ErrorDetail {
  code: ErrorCode | string;
  message: string;
}

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
