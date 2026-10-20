import { z } from 'zod';
import { DimensionSchema } from './values';

export const RADIUS_OPTIONS = ['xs', 'sm', 'thumb', 'card', 'sheet', 'control', 'chip'] as const;

export type RadiusOption = (typeof RADIUS_OPTIONS)[number];

export const RadiusSchema = z.record(z.enum(RADIUS_OPTIONS), DimensionSchema);
