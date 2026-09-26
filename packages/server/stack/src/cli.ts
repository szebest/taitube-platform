import { parseArgs } from 'node:util';
import { type StackHost, down, status, up } from './stack';

const DEFAULT_FILE = 'infra/compose/docker-compose.yml';

const USAGE = `pnpm stack <command> [targets...] [options]    (make up, make down, make status)

  up [targets]   start the targets and what they depend on, a tier at a time, each gated on health
                   (none)               the infrastructure: Postgres, Redis, MinIO and its buckets
                   api | web | worker   an app, with migrate and the infrastructure it needs
                   worker:<stage>       one stage, e.g. worker:thumbnail, worker:transcode (all three)
                   all                  the infrastructure and every app
                   <profile> | <name>   observability, tools, chaos, or one service by name
  down           stop every service and delete the volumes
  status         every service, its state and where to reach it

  -f, --file <path>         compose file, repeatable (default ${DEFAULT_FILE})
      --no-build            start the images already built instead of building them first
      --wait-timeout <sec>  how long one tier may take to become healthy (default 180)`;

export async function run(
  argv: readonly string[],
  host: Omit<StackHost, 'files'>
): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      file: { type: 'string', short: 'f', multiple: true, default: [DEFAULT_FILE] },
      'no-build': { type: 'boolean', default: false },
      'wait-timeout': { type: 'string', default: '180' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const stack = { ...host, files: values.file };
  const [command, ...targets] = positionals;

  switch (values.help ? 'help' : command) {
    case 'up':
      return up(stack, targets, {
        build: !values['no-build'],
        waitTimeoutSec: Number(values['wait-timeout']),
      });
    case 'down':
      return down(stack);
    case 'status':
      return status(stack);
    case 'help':
      host.print(USAGE);
      return 0;
    default:
      host.print(USAGE);
      return 2;
  }
}
