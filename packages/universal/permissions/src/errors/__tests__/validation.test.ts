import { ErrorCodes, PermanentError } from '@vp/errors';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createValidationError, formatZodError, zodValidationAdapter } from '../validation-adapter';

describe('errors/validation: Zod Schema RFC 9457 Validation Adapter', () => {
  const schema = z.object({
    title: z.string().min(3),
    visibility: z.enum(['public', 'private', 'unlisted']),
    nested: z.object({
      field: z.number(),
    }),
  });

  it('formats zod issues into invalidParams with dot-separated paths', () => {
    const result = schema.safeParse({
      title: 'a',
      visibility: 'invalid',
      nested: { field: 'not-num' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const invalidParams = formatZodError(result.error);
      expect(invalidParams).toHaveLength(3);
      expect(invalidParams.map((p) => p.name)).toEqual(['title', 'visibility', 'nested.field']);
    }
  });

  it('creates PermanentError with VALIDATION_FAILED and structured details', () => {
    const invalidParams = [{ name: 'title', reason: 'Too short' }];
    const error = createValidationError('Title is invalid', invalidParams);
    expect(error).toBeInstanceOf(PermanentError);
    expect(error.code).toBe(ErrorCodes.VALIDATION_FAILED);
    expect(error.details?.invalidParams).toEqual(invalidParams);
  });

  it('converts ZodError directly into PermanentError via zodValidationAdapter', () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = zodValidationAdapter(result.error);
      expect(error).toBeInstanceOf(PermanentError);
      expect(error.code).toBe(ErrorCodes.VALIDATION_FAILED);
      expect(error.details?.invalidParams).toBeDefined();
    }
  });
});
