import { type AppEnv, AppEnvSchema } from '@vp/env-schema';
import { type Result, err, isErr, ok } from '@vp/result';

const SECRET_KEY_PATTERN = /password|secret|key|token|auth/i;

export interface InvalidEnv {
  type: 'invalid-env';
  /** One `KEY: reason` per invalid key, with a sensitive key's details redacted. */
  issues: string[];
}

export function parseEnv(env: Record<string, string | undefined>): Result<AppEnv, InvalidEnv> {
  const result = AppEnvSchema.safeParse(env);

  if (result.success) return ok(result.data);

  const issues = result.error.issues.map((issue) => {
    const key = issue.path.join('.');
    const isSecret = SECRET_KEY_PATTERN.test(key) || /url/i.test(key);
    return `${key}: ${issue.message}${isSecret ? ' (sensitive key - details redacted)' : ''}`;
  });
  return err({ type: 'invalid-env', issues });
}

/** Throws a message naming every invalid key, secrets redacted, for the entrypoint to report. */
export function loadEnv(env: Record<string, string | undefined> = process.env): AppEnv {
  const parsed = parseEnv(env);
  if (isErr(parsed)) {
    const lines = parsed.error.issues.map((issue) => `  - ${issue}`);
    throw new Error(`[FATAL] Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return parsed.value;
}
