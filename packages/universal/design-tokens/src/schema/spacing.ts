import { z } from 'zod';
import { DimensionSchema } from './values';

export const SpacingSchema = z.record(
  z.enum([
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
  ]),
  DimensionSchema
);
