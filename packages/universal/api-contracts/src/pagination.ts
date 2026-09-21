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

/**
 * Decodes the base64url JSON a cursor carries. Deliberately runtime-agnostic —
 * `atob` rather than `Buffer` — because this package also runs in the browser.
 */
export function decodeCursorPayload(cursor: string): Record<string, unknown> | null {
  try {
    const base64 = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export type KeysetQuery = z.input<typeof KeysetQuerySchema>;
