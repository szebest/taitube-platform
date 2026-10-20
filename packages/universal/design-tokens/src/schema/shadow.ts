import { z } from 'zod';
import { MODE_FAMILIES, ShadowLayersSchema } from './values';

export const ELEVATION_OPTIONS = [1, 2, 3] as const;

export type ElevationOption = (typeof ELEVATION_OPTIONS)[number];

const ELEVATION_KEYS = MODE_FAMILIES.flatMap((family) =>
  ELEVATION_OPTIONS.map((step) => `${family}-${step}` as const)
);

export const ShadowSchema = z.record(z.enum(ELEVATION_KEYS), ShadowLayersSchema);
