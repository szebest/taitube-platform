import { z } from 'zod';
import { DimensionSchema } from './values';

export const BorderSchema = z.record(
  z.enum(['divider', 'control', 'focus', 'focus-offset']),
  DimensionSchema
);
