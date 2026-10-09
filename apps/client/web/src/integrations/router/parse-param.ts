import { notFound } from '@tanstack/react-router';
import type { z } from 'zod';

/** A path segment that fails its schema names no resource, so the route renders not-found. */
export function parseParam<T>(schema: z.ZodType<T>, raw: string): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw notFound();
  return parsed.data;
}
