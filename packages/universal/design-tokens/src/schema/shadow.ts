import { z } from 'zod';
import { ShadowLayersSchema } from './values';

export const ShadowSchema = z.record(
  z.enum(['dark-1', 'dark-2', 'dark-3', 'light-1', 'light-2', 'light-3']),
  ShadowLayersSchema
);
