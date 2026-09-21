import type { ErrorCode } from '@vp/errors';
import { z } from 'zod';

export const ProblemSchema = z.object({
  type: z.string().describe('URI reference identifying the problem type'),
  title: z.string().describe('Short summary of the problem type'),
  status: z.number().describe('HTTP status code'),
  detail: z.string().describe('Human-readable explanation specific to this occurrence'),
  code: z.string().describe('Machine-readable error code'),
  instance: z.string().describe('URI reference identifying the specific occurrence'),
  errors: z.array(z.unknown()).optional().describe('Validation issues if status is 400'),
});

export type Problem = z.infer<typeof ProblemSchema>;

export function problemResponse(
  codes: readonly ErrorCode[] | readonly string[],
  description = 'Problem Details (RFC 9457)'
): z.ZodTypeAny {
  return ProblemSchema.extend({
    code:
      codes.length > 0
        ? z.enum(codes as unknown as [string, ...string[]]).describe('Machine-readable error code')
        : z.string().describe('Machine-readable error code'),
  }).describe(description);
}
