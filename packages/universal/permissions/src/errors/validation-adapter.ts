import { ErrorCodes, PermanentError } from '@vp/errors';
import type { ZodError, ZodIssue } from 'zod';

export interface InvalidParam {
  name: string;
  reason: string;
}

export function formatZodIssues(issues: ZodIssue[]): InvalidParam[] {
  return issues.map((issue) => ({
    name: issue.path.length > 0 ? issue.path.join('.') : 'body',
    reason: issue.message,
  }));
}

export function formatZodError(error: ZodError): InvalidParam[] {
  return formatZodIssues(error.issues);
}

export function createValidationError(
  message: string,
  invalidParams: InvalidParam[]
): PermanentError {
  return new PermanentError(ErrorCodes.VALIDATION_FAILED, message, {
    invalidParams,
  });
}

export function zodValidationAdapter(error: ZodError): PermanentError {
  const invalidParams = formatZodError(error);
  const detail = invalidParams.map((p) => `${p.name}: ${p.reason}`).join('; ');
  return createValidationError(`Validation failed: ${detail}`, invalidParams);
}
