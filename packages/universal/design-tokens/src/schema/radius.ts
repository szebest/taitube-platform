import { z } from 'zod';
import { DimensionSchema } from './values';

export const RadiusSchema = z.record(
  z.enum(['xs', 'sm', 'thumb', 'card', 'sheet', 'control', 'chip']),
  DimensionSchema
);
