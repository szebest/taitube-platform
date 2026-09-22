import { type Problem, ProblemSchema } from '@vp/api-contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly problem?: Problem
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The response did not match the schema the contract promises for this endpoint. */
export class ApiContractError extends Error {
  constructor(
    readonly endpoint: string,
    readonly issues: readonly { path: (string | number)[]; message: string }[]
  ) {
    super(
      `${endpoint} returned a payload the contract does not describe: ${issues
        .map((issue) => `${issue.path.join('.') || '<root>'} ${issue.message}`)
        .join('; ')}`
    );
    this.name = 'ApiContractError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function toApiError(status: number, body: unknown): ApiError {
  const parsed = ProblemSchema.safeParse(body);
  if (parsed.success) {
    return new ApiError(status, parsed.data.code, parsed.data.detail, parsed.data);
  }
  return new ApiError(status, 'HTTP_ERROR', `Request failed with status ${status}`);
}
