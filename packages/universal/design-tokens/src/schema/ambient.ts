import { z } from 'zod';
import { DimensionSchema, DurationSchema, OpacitySchema } from './values';

export const AmbientSchema = z.strictObject({
  enabled: z.boolean(),
  'opacity-dark': OpacitySchema,
  'opacity-light': OpacitySchema,
  blur: DimensionSchema,
  sample: DurationSchema,
});
