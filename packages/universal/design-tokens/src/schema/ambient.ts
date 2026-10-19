import { z } from 'zod';
import type { TokenGroupDefinition } from './token-group';
import { DimensionSchema, DurationSchema, OpacitySchema } from './values';

export const ambientGroup = {
  path: 'ambient',
  schema: z.strictObject({
    enabled: z.boolean(),
    'opacity-dark': OpacitySchema,
    'opacity-light': OpacitySchema,
    blur: DimensionSchema,
    sample: DurationSchema,
  }),
} as const satisfies TokenGroupDefinition;
