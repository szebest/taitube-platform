import type { ZodType } from 'zod';

export interface TokenGroupDefinition {
  readonly path: string;
  readonly schema: ZodType;
}
