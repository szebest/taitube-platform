import { type Result, err, ok } from '@vp/result';
import { type InvalidDisplayName, invalidDisplayName } from './failures.js';

export const DISPLAY_NAME_MIN_LENGTH = 1;
export const DISPLAY_NAME_MAX_LENGTH = 100;

const BOUNDS = { minLength: DISPLAY_NAME_MIN_LENGTH, maxLength: DISPLAY_NAME_MAX_LENGTH };

export function validateDisplayName(displayName: string): Result<string, InvalidDisplayName> {
  const trimmed = displayName.trim();
  return trimmed.length < BOUNDS.minLength || trimmed.length > BOUNDS.maxLength
    ? err(invalidDisplayName(BOUNDS))
    : ok(trimmed);
}
