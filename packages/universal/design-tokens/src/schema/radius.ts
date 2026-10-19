import { z } from 'zod';
import type { TokenGroupDefinition } from './token-group';
import { DimensionSchema } from './values';

export const radiusGroup = {
  path: 'radius',
  schema: z.record(
    z.enum(['xs', 'sm', 'thumb', 'card', 'sheet', 'control', 'chip']),
    DimensionSchema
  ),
} as const satisfies TokenGroupDefinition;
