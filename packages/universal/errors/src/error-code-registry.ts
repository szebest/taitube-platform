import { defineErrorCodes, isRegisteredCode } from '@kit/errors';
import { type ErrorCode, ErrorCodes } from './error-codes';
import { RETRY_CLASS } from './retry-class';

export const errorCodeRegistry = defineErrorCodes({
  codes: ErrorCodes,
  retryClass: RETRY_CLASS,
  internal: ErrorCodes.INTERNAL,
});

export const isErrorCode = (code: unknown): code is ErrorCode =>
  isRegisteredCode(errorCodeRegistry, code);
