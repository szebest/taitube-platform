import { type AppEnv, DEFAULT_LOG_LEVEL } from '@vp/env-schema';
import { type LoggerConfig, createLogger } from '@vp/logger';
import { isOk } from '@vp/result';
import { parseEnv } from './load-env';

export interface BootHost {
  env: Record<string, string | undefined>;
  exit: (code: number) => never;
}

/**
 * For an entrypoint that has no logger yet: the environment is what chooses the log level, so one
 * that does not parse is reported at the default level, as one line on stderr, and the process exits 1.
 */
export function loadEnvOrExit(
  service: string,
  host: BootHost,
  destination?: LoggerConfig['destination']
): AppEnv {
  const parsed = parseEnv(host.env);
  if (isOk(parsed)) return parsed.value;

  const log = createLogger({ service, level: DEFAULT_LOG_LEVEL, format: 'pretty', destination });
  log.fatal({ invalid: parsed.error.issues }, 'invalid environment configuration');
  return host.exit(1);
}
