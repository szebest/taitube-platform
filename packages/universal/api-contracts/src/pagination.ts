import { z } from 'zod';

export const CursorSchema = z.string().describe('Opaque base64url keyset pagination cursor');

export const PageLimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(100)
  .default(20)
  .describe('Page size limit (1-100, default 20)');

export const KeysetQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: PageLimitSchema,
});

export type KeysetQuery = z.input<typeof KeysetQuerySchema>;
