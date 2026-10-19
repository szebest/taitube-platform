import { z } from 'zod';
import type { TokenGroupDefinition } from './token-group';
import { ShadowSchema } from './values';

export const shadowGroup = {
  path: 'shadow',
  schema: z.record(
    z.enum(['dark-1', 'dark-2', 'dark-3', 'light-1', 'light-2', 'light-3']),
    ShadowSchema
  ),
} as const satisfies TokenGroupDefinition;
