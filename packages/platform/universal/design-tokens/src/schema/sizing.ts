import { z } from 'zod';
import { DimensionSchema } from './values';

export const SIZE_OPTIONS = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

export type SizeOption = (typeof SIZE_OPTIONS)[number];

export const CONTROL_SIZES = ['sm', 'md', 'lg'] as const;

export type ControlSize = (typeof CONTROL_SIZES)[number];

export const ICON_SIZES = ['sm', 'md', 'lg'] as const;

export type IconSize = (typeof ICON_SIZES)[number];

export const SizingSchema = z.strictObject({
  control: z.record(z.enum(CONTROL_SIZES), DimensionSchema),
  icon: z.record(z.enum(ICON_SIZES), DimensionSchema),
  avatar: z.record(z.enum(SIZE_OPTIONS), DimensionSchema),
  layout: z.record(
    z.enum(['touch-target', 'header', 'rail-expanded', 'rail-collapsed', 'card-min', 'row-thumb']),
    DimensionSchema
  ),
});
