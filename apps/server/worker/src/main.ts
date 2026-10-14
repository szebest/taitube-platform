import type { ProcessHost } from '@vp/composition';
import { createLogger } from '@vp/logger';
import { run } from './process';

if (process.env['NODE_ENV'] !== 'test') {
  const host: ProcessHost = {
    env: process.env,
    onSignal: (signal, handler) => process.on(signal, handler),
    exit: (code) => process.exit(code),
  };
  void run(host, createLogger({ service: 'vp-worker', level: 'info', format: 'json' }));
}
