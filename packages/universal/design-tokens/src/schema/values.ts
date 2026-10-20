import { z } from 'zod';

export const MODE_FAMILIES = ['dark', 'light'] as const;

export type ModeFamily = (typeof MODE_FAMILIES)[number];

export const DimensionSchema = z.string().regex(/^-?\d+(\.\d+)?(px|em)$/);

export const DurationSchema = z.string().regex(/^\d+ms$/);

export const ColorSchema = z.templateLiteral([
  '#',
  z.string().regex(/^[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/),
]);

export type HexColor = z.output<typeof ColorSchema>;

export const FontFamilySchema = z.array(z.string().min(1)).min(1);

export const FontWeightSchema = z.int().min(1).max(1000);

export const LineHeightSchema = z.number().positive();

export const OpacitySchema = z.number().min(0).max(1);

const BezierXSchema = z.number().min(0).max(1);

export const CubicBezierSchema = z.tuple([BezierXSchema, z.number(), BezierXSchema, z.number()]);

export const ShadowLayersSchema = z
  .array(
    z.strictObject({
      color: ColorSchema,
      offsetX: DimensionSchema,
      offsetY: DimensionSchema,
      blur: DimensionSchema,
      spread: DimensionSchema,
    })
  )
  .min(1);
