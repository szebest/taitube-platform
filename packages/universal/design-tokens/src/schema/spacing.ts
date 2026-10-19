import { z } from 'zod';
import type { TokenGroupDefinition } from './token-group';
import { DimensionSchema } from './values';

export const spacingGroup = {
  path: 'spacing',
  schema: z.record(
    z.enum([
      'inset-control',
      'inset-card',
      'gap-inline',
      'gap-stack',
      'gap-grid-x',
      'gap-grid-y',
      'gap-shelf',
      'section',
      'gutter-compact',
      'gutter-medium',
      'gutter-expanded',
    ]),
    DimensionSchema
  ),
} as const satisfies TokenGroupDefinition;
