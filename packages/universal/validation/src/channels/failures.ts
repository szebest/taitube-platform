import { ErrorCodes, type InputFailure } from '@vp/errors';
import { type InvalidField, type LengthBounds, invalidLength } from '../failures.js';

export type InvalidHandleFormat = InputFailure<
  typeof ErrorCodes.INVALID_HANDLE_FORMAT,
  { handle: string; minLength: number; maxLength: number; reserved: boolean }
>;

export type InvalidDisplayName = InvalidField<LengthBounds>;

export function invalidHandleFormat(
  handle: string,
  bounds: LengthBounds,
  reserved = false
): InvalidHandleFormat {
  return {
    code: ErrorCodes.INVALID_HANDLE_FORMAT,
    message: reserved
      ? `Handle "${handle}" is reserved`
      : `Invalid handle format: must be ${bounds.minLength}-${bounds.maxLength} characters matching ^[a-zA-Z0-9_.-]+$`,
    field: 'handle',
    handle,
    minLength: bounds.minLength,
    maxLength: bounds.maxLength,
    reserved,
  };
}

export function invalidDisplayName(bounds: LengthBounds): InvalidDisplayName {
  return invalidLength('displayName', bounds);
}
