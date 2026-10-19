import { z } from 'zod';
import type { TokenGroupDefinition } from './token-group';
import { DimensionSchema } from './values';

export const borderGroup = {
  path: 'border',
  schema: z.record(z.enum(['divider', 'control', 'focus', 'focus-offset']), DimensionSchema),
} as const satisfies TokenGroupDefinition;
