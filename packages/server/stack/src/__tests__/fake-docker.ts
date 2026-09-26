import type { StackHost } from '../stack';

const completed = { condition: 'service_completed_successfully' };
const healthy = { condition: 'service_healthy' };
const app = { context: '../..', dockerfile: 'Dockerfile' };

const COMPOSE_CONFIG = JSON.stringify({
  services: {
    postgres: {},
    migrate: { build: app, profiles: ['migrate'], depends_on: { postgres: healthy } },
    api: { build: app, profiles: ['api'], depends_on: { migrate: completed } },
    web: { build: app, profiles: ['web'], depends_on: { api: healthy } },
    grafana: { profiles: ['observability'] },
  },
});

export const psRow = (Service: string, fields: Record<string, unknown> = {}) =>
  JSON.stringify({
    Service,
    State: 'running',
    Health: 'healthy',
    ExitCode: 0,
    Publishers: [],
    ...fields,
  });

interface Answer {
  code?: number;
  stdout?: string;
  stderr?: string;
}

/** A docker that records what it was asked and answers by the compose subcommand. */
export function fakeDocker(
  answers: Partial<Record<string, Answer | ((args: string[]) => Answer)>> = {}
) {
  const calls: string[][] = [];
  const printed: string[] = [];
  const subcommand = (args: readonly string[]) => {
    if (args[0] !== 'compose') return [...args];
    const flags = new Set(['-f', '--profile']);
    const rest = args.slice(1);
    for (let i = 0; i < rest.length; i++) {
      if (flags.has(rest[i] as string)) i++;
      else return rest.slice(i);
    }
    return [];
  };
  const answer = (args: readonly string[]): Required<Answer> => {
    const [name = '', ...rest] = subcommand(args);
    const key = name === 'config' ? `config ${rest[0]}` : name;
    const defaults: Record<string, Answer> = {
      'config --profiles': { stdout: 'api\nmigrate\nobservability\nweb\n' },
      'config --format': { stdout: COMPOSE_CONFIG },
    };
    const found = answers[key] ?? defaults[key] ?? {};
    const {
      code = 0,
      stdout = '',
      stderr = '',
    } = typeof found === 'function' ? found([...rest]) : found;
    return { code, stdout, stderr };
  };
  const host: StackHost = {
    files: ['compose.yml'],
    print: (text) => printed.push(text),
    docker: {
      show: async (args) => {
        calls.push([...args]);
        return answer(args).code;
      },
      capture: async (args) => {
        calls.push([...args]);
        return answer(args);
      },
    },
  };
  return {
    host,
    calls,
    printed,
    subcommands: () => calls.map((args) => subcommand(args).join(' ')),
  };
}
