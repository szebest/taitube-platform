import type { ProcessHost } from '@kit/composition';
import { type LoggerConfig, createLogger } from '@kit/logger';
import { isOk } from '@kit/result';
import type { z } from 'zod';
import { parseEnv } from './load-env';

/**
 * For an entrypoint that has no logger yet: the environment is what chooses the log level, so one
 * that does not parse is reported at the level it is handed, as one JSON line like the rest of the
 * process's output, and the host exits 1. `undefined` is what a host that did not exit gets back.
 */
export function loadEnvOrExit<T>(
  schema: z.ZodType<T>,
  defaultLogLevel: string,
  service: string,
  host: Pick<ProcessHost, 'env' | 'exit'>,
  destination?: LoggerConfig['destination']
): T | undefined {
  const parsed = parseEnv(schema, host.env);
  if (isOk(parsed)) return parsed.value;

  const log = createLogger({ service, level: defaultLogLevel, format: 'json', destination });
  log.fatal({ invalid: parsed.error.issues }, 'invalid environment configuration');
  host.exit(1);
  return undefined;
}
