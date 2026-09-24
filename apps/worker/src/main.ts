import { run } from './process';

if (process.env['NODE_ENV'] !== 'test') {
  void run({
    env: process.env,
    onSignal: (signal, handler) => process.on(signal, handler),
    exit: (code) => process.exit(code),
  });
}
