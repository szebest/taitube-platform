import { z } from 'zod';
import { DimensionSchema, LineHeightSchema } from './values';

export const TYPE_STYLE_OPTIONS = [
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
] as const;

export type TypeStyleOption = (typeof TYPE_STYLE_OPTIONS)[number];

export const TypeStyleSchema = z.enum(TYPE_STYLE_OPTIONS);

export const FontSizeSchema = z.record(
  TypeStyleSchema,
  z.strictObject({ size: DimensionSchema, lineHeight: LineHeightSchema })
);
