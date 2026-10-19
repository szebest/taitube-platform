import { z } from 'zod';
import { DimensionSchema } from './values';

const ControlSizeSchema = z.enum(['sm', 'md', 'lg']);

export const SizingSchema = z.strictObject({
  control: z.record(ControlSizeSchema, DimensionSchema),
  icon: z.record(ControlSizeSchema, DimensionSchema),
  avatar: z.record(z.enum(['xs', 'sm', 'md', 'lg', 'xl']), DimensionSchema),
  layout: z.record(
    z.enum(['touch-target', 'header', 'rail-expanded', 'rail-collapsed', 'card-min', 'row-thumb']),
    DimensionSchema
  ),
});
