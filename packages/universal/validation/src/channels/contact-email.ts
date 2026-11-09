import { type Result, err, ok } from '@vp/result';
import { type InvalidField, invalidField } from '../failures';

export const CONTACT_EMAIL_MAX_LENGTH = 254;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InvalidContactEmail = InvalidField<{ maxLength: number }>;

/** `null` clears the address; one comes back trimmed and lowercased. */
export function validateContactEmail(
  email: string | null
): Result<string | null, InvalidContactEmail> {
  if (email === null) return ok(null);

  const normalized = email.trim().toLowerCase();
  return normalized.length <= CONTACT_EMAIL_MAX_LENGTH && EMAIL_SHAPE.test(normalized)
    ? ok(normalized)
    : err(
        invalidField('contactEmail', 'The contact email is not an email address', {
          maxLength: CONTACT_EMAIL_MAX_LENGTH,
        })
      );
}
