import { z } from 'zod';
import type { TokenGroupDefinition } from './token-group';
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

export const fontSizeGroup = {
  path: 'font-size',
  schema: z.record(
    TypeStyleSchema,
    z.strictObject({ size: DimensionSchema, lineHeight: LineHeightSchema })
  ),
} as const satisfies TokenGroupDefinition;
