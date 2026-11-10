import { join } from 'node:path';
import { run } from './env-docs/run';

const outcome = await run(process.argv.slice(2), join(import.meta.dirname, '..'));

process.stdout.write(outcome.stdout);
process.stderr.write(outcome.stderr);
process.exitCode = outcome.code;
