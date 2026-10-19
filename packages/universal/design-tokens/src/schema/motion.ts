import { z } from 'zod';
import type { TokenGroupDefinition } from './token-group';
import { CubicBezierSchema, DurationSchema } from './values';

export const motionGroup = {
  path: 'motion',
  schema: z.strictObject({
    duration: z.record(z.enum(['instant', 'fast', 'base', 'slow', 'cinematic']), DurationSchema),
    easing: z.record(z.enum(['standard', 'enter', 'exit', 'settle']), CubicBezierSchema),
  }),
} as const satisfies TokenGroupDefinition;
