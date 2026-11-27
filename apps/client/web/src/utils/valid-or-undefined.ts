import { z } from 'zod';

/** A search param read with `schema`, or left out when it does not parse, so a bad URL still renders. */
export function validOrUndefined<T>(schema: z.ZodType<T>) {
  return z
    .unknown()
    .optional()
    .transform((value) => {
      const parsed = schema.safeParse(value);
      return parsed.success ? parsed.data : undefined;
    });
}
