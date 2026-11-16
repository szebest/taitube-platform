import type { Command } from './host';
import type { DemoRunOptions } from './options';

const COMPOSE_FILE = 'infra/compose/docker-compose.yml';

const CORE_WORKER_STAGES = [
  'worker:probe',
  'worker:transcode',
  'worker:thumbnail',
  'worker:package',
  'worker:notify',
  'worker:housekeeping',
  'worker:screen',
] as const;

const IMAGES = ['vp-api:local', 'vp-web:local', 'vp-studio:local', 'vp-worker:local'];

/** The seed and the worker stages talk to the API, so a run with workers always starts it. */
export function stackApps(options: DemoRunOptions): DemoRunOptions['only'] {
  if (options.only.length === 0) return ['api', 'web', 'studio'];
  return options.withWorker && !options.only.includes('api')
    ? [...options.only, 'api']
    : options.only;
}

/** The `pnpm stack up` targets; the stack adds the infrastructure and migrate through `depends_on`. */
export function stackTargets(options: DemoRunOptions): string[] {
  const full = options.profile === 'full' && options.withWorker && options.only.length === 0;
  const targets: string[] = full ? ['all'] : [...stackApps(options)];
  if (!full && options.withWorker) targets.push(...CORE_WORKER_STAGES);
  if (options.observability) targets.push('observability');
  return targets;
}

export function stackUp(options: DemoRunOptions, build: boolean): Command {
  return {
    command: 'pnpm',
    args: ['--silent', 'stack', 'up', ...stackTargets(options), ...(build ? [] : ['--no-build'])],
  };
}

export const STACK_DOWN: Command = { command: 'pnpm', args: ['--silent', 'stack', 'down'] };
export const STACK_STATUS: Command = { command: 'pnpm', args: ['--silent', 'stack', 'status'] };

export const STACK_STOP: Command = {
  command: 'docker',
  args: ['compose', '-f', COMPOSE_FILE, '--profile', '*', 'stop'],
};

export const IMAGES_PRESENT: Command = {
  command: 'docker',
  args: ['image', 'inspect', '--format', '{{.Id}}', ...IMAGES],
};

export const COMPOSE_PS: Command = {
  command: 'docker',
  args: ['compose', '-f', COMPOSE_FILE, '--profile', '*', 'ps', '--format', 'json'],
};

export function requiredPorts(options: DemoRunOptions): number[] {
  const ports = new Set([5432, 6379, 9000, 9001]);
  const apps = stackApps(options);
  if (apps.includes('api')) ports.add(3000);
  if (apps.includes('web')) ports.add(5173);
  if (apps.includes('studio')) ports.add(5174);
  if (options.observability) ports.add(3001);
  return [...ports].sort((a, b) => a - b);
}
