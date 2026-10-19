import { z } from 'zod';
import { DimensionSchema, LineHeightSchema } from './values';

export const TypeStyleSchema = z.enum([
  'display',
  'headline',
  'title-lg',
  'title',
  'body',
  'body-sm',
  'label',
  'caption',
  'overline',
  'editorial',
  'mono',
]);

export const FontSizeSchema = z.record(
  TypeStyleSchema,
  z.strictObject({ size: DimensionSchema, lineHeight: LineHeightSchema })
);
