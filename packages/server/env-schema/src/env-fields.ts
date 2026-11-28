import { z } from 'zod';

/**
 * A secret has no default: an unset one is absent, and `AppEnvSchema` refuses a production boot
 * without it. An empty value reads as unset, which is what `KEY=` in a `.env` file means.
 */
export const secret = () =>
  z
    .string()
    .optional()
    .transform((value) => value || undefined);
