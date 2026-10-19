import { z } from 'zod';
import { TypeStyleSchema } from './font-size';
import type { TokenGroupDefinition } from './token-group';
import { DimensionSchema, FontFamilySchema, FontWeightSchema } from './values';

export const typographyGroup = {
  path: 'typography',
  schema: z.strictObject({
    font: z.record(z.enum(['sans', 'editorial', 'mono']), FontFamilySchema),
    weight: z.record(TypeStyleSchema, FontWeightSchema),
    tracking: z.record(TypeStyleSchema, DimensionSchema),
  }),
} as const satisfies TokenGroupDefinition;
