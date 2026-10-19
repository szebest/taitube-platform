import { z } from 'zod';
import { CubicBezierSchema, DurationSchema } from './values';

export const MotionSchema = z.strictObject({
  duration: z.record(z.enum(['instant', 'fast', 'base', 'slow', 'cinematic']), DurationSchema),
  easing: z.record(z.enum(['standard', 'enter', 'exit', 'settle']), CubicBezierSchema),
});
