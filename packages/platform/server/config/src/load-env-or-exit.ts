import type { ProcessHost } from '@vp/composition';
import { type AppEnv, DEFAULT_LOG_LEVEL } from '@vp/env-schema';
import { type LoggerConfig, createLogger } from '@vp/logger';
import { isOk } from '@vp/result';
import { parseEnv } from './load-env';

/**
 * For an entrypoint that has no logger yet: the environment is what chooses the log level, so one
 * that does not parse is reported at the default level, as one JSON line like the rest of the
 * process's output, and the host exits 1. `undefined` is what a host that did not exit gets back.
 */
export function loadEnvOrExit(
  service: string,
  host: Pick<ProcessHost, 'env' | 'exit'>,
  destination?: LoggerConfig['destination']
): AppEnv | undefined {
  const parsed = parseEnv(host.env);
  if (isOk(parsed)) return parsed.value;

  const log = createLogger({ service, level: DEFAULT_LOG_LEVEL, format: 'json', destination });
  log.fatal({ invalid: parsed.error.issues }, 'invalid environment configuration');
  host.exit(1);
  return undefined;
}
