import { z } from 'zod';
import { TypeStyleSchema } from './font-size';
import { DimensionSchema, FontFamilySchema, FontWeightSchema } from './values';

export const TypographySchema = z.strictObject({
  font: z.record(z.enum(['sans', 'editorial', 'mono']), FontFamilySchema),
  weight: z.record(TypeStyleSchema, FontWeightSchema),
  tracking: z.record(TypeStyleSchema, DimensionSchema),
});
