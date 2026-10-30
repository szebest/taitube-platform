import { type Problem, ProblemSchema } from '@vp/api-contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly problem?: Problem,
    /** How long the server asked the caller to wait, from `Retry-After`. */
    readonly retryAfterMs?: number
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
    readonly issues: readonly { path: PropertyKey[]; message: string }[]
  ) {
    super(
      `${endpoint} returned a payload the contract does not describe: ${issues
        .map((issue) => `${issue.path.map(String).join('.') || '<root>'} ${issue.message}`)
        .join('; ')}`
    );
    this.name = 'ApiContractError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const SECOND_MS = 1000;

function retryAfterMs(headers: Headers | undefined, now: number): number | undefined {
  const value = headers?.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * SECOND_MS);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

export function toApiError(status: number, body: unknown, headers?: Headers): ApiError {
  const wait = retryAfterMs(headers, Date.now());
  const parsed = ProblemSchema.safeParse(body);
  if (parsed.success) {
    return new ApiError(status, parsed.data.code, parsed.data.detail, parsed.data, wait);
  }
  return new ApiError(
    status,
    'HTTP_ERROR',
    `Request failed with status ${status}`,
    undefined,
    wait
  );
}
