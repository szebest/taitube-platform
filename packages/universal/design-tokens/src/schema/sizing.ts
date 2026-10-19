import { z } from 'zod';
import type { TokenGroupDefinition } from './token-group';
import { DimensionSchema } from './values';

const ControlSizeSchema = z.enum(['sm', 'md', 'lg']);

export const sizingGroup = {
  path: 'sizing',
  schema: z.strictObject({
    control: z.record(ControlSizeSchema, DimensionSchema),
    icon: z.record(ControlSizeSchema, DimensionSchema),
    avatar: z.record(z.enum(['xs', 'sm', 'md', 'lg', 'xl']), DimensionSchema),
    layout: z.record(
      z.enum([
        'touch-target',
        'header',
        'rail-expanded',
        'rail-collapsed',
        'card-min',
        'row-thumb',
      ]),
      DimensionSchema
    ),
  }),
} as const satisfies TokenGroupDefinition;
