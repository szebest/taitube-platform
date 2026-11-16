import { type ErrorCode, ErrorCodes } from './error-codes';
import { defineErrorCodes, isRegisteredCode } from './registry';
import { RETRY_CLASS } from './retry-class';

export const errorCodeRegistry = defineErrorCodes({
  codes: ErrorCodes,
  retryClass: RETRY_CLASS,
  internal: ErrorCodes.INTERNAL,
});

export const isErrorCode = (code: unknown): code is ErrorCode =>
  isRegisteredCode(errorCodeRegistry, code);
