import { type AppEnv, AppEnvSchema } from '@vp/env-schema';

const SECRET_KEY_PATTERN = /password|secret|key|token|auth/i;

export function loadEnv(
  env: Record<string, string | undefined> = process.env,
  options: { exitOnError?: boolean } = { exitOnError: true }
): AppEnv {
  const result = AppEnvSchema.safeParse(env);

  if (result.success) return result.data;

  const errorLines = result.error.issues.map((issue) => {
    const key = issue.path.join('.');
    const isSecret = SECRET_KEY_PATTERN.test(key) || /url/i.test(key);
    return `  - ${key}: ${issue.message}${isSecret ? ' (sensitive key - details redacted)' : ''}`;
  });
  const message = `[FATAL] Invalid environment configuration:\n${errorLines.join('\n')}`;

  console.error(message);
  if (options.exitOnError) process.exit(1);
  throw new Error(message);
}
