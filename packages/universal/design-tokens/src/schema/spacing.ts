import { z } from 'zod';
import { DimensionSchema } from './values';

export const SPACE_STEPS = [
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
] as const;

export type SpaceStep = (typeof SPACE_STEPS)[number];

export const SpacingSchema = z.record(z.enum(SPACE_STEPS), DimensionSchema);
