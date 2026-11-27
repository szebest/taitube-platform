import type { ProcessHost } from '@kit/composition';
import { createLogger } from '@kit/logger';
import { run } from './process';

if (process.env.NODE_ENV !== 'test') {
  const host: ProcessHost = {
    env: process.env,
    onSignal: (signal, handler) => process.on(signal, handler),
    exit: (code) => process.exit(code),
  };
  void run(host, createLogger({ service: 'vp-api', level: 'info', format: 'json' }));
}
