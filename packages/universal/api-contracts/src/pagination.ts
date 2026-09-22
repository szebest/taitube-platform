import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@vp/pagination';
import { z } from 'zod';

export const CursorSchema = z.string().describe('Opaque base64url keyset pagination cursor');

const PAGE_LIMIT_DESCRIPTION = `Page size limit (1-${PAGE_SIZE_MAX}, default ${PAGE_SIZE_DEFAULT}). A deployment with a lower PAGE_SIZE_MAX clamps rather than rejects: the page comes back shorter than asked for and nextCursor walks the remainder.`;

export const PageLimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(PAGE_SIZE_MAX)
  .default(PAGE_SIZE_DEFAULT)
  .describe(PAGE_LIMIT_DESCRIPTION);

export const KeysetQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: PageLimitSchema,
});

export type KeysetQuery = z.input<typeof KeysetQuerySchema>;
