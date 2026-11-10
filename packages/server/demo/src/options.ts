import { parseArgs } from 'node:util';
import { type Result, err, ok, tryCatch } from '@vp/result';
import { PERSONAS, findPersona } from './logins';
import type { DemoOptions, DemoProfile } from './types';

const APPS = ['web', 'studio', 'api'] as const;
type DemoApp = (typeof APPS)[number];

const COMMANDS = ['up', 'seed', 'reset', 'down', 'status', 'login', 'help'] as const;

export const PROFILE_DEFAULTS: Record<
  DemoProfile,
  { videos: number; users: number; channels: number }
> = {
  minimal: { videos: 8, users: 12, channels: 4 },
  full: { videos: 24, users: 30, channels: 8 },
};

export const DEFAULTS = {
  profile: 'minimal',
  seed: 1729,
  withWorker: true,
  apiUrl: 'http://localhost:3000',
  workDir: '.demo',
} as const;

const RANGES = {
  videos: { min: 0, max: 200 },
  users: { min: 1, max: 1000 },
  channels: { min: 1, max: 100 },
  seed: { min: 0, max: 2_147_483_647 },
} as const;

export interface DemoRunOptions extends DemoOptions {
  reset: boolean;
  observability: boolean;
  only: readonly DemoApp[];
  noBuild: boolean;
  purgeMedia: boolean;
}

export type DemoCommand =
  | { kind: 'help' }
  | { kind: 'up' | 'seed' | 'reset' | 'down' | 'status'; options: DemoRunOptions }
  | { kind: 'login'; persona: string; options: DemoRunOptions };

interface Flag {
  flag: string;
  env: string | undefined;
  envValue?: string;
  value: string | undefined;
  default: string;
  about: string;
}

export const FLAGS: readonly Flag[] = [
  {
    flag: '--profile',
    env: 'DEMO_PROFILE',
    value: 'minimal|full',
    default: DEFAULTS.profile,
    about: 'minimal: infra, api, web, studio and the core worker stages; full: every app (all)',
  },
  {
    flag: '--videos',
    env: 'DEMO_VIDEOS',
    value: '<n>',
    default: `${PROFILE_DEFAULTS.minimal.videos} minimal, ${PROFILE_DEFAULTS.full.videos} full`,
    about: 'videos uploaded through the real pipeline',
  },
  {
    flag: '--users',
    env: 'DEMO_USERS',
    value: '<n>',
    default: `${PROFILE_DEFAULTS.minimal.users} minimal, ${PROFILE_DEFAULTS.full.users} full`,
    about: 'viewers in the demo world',
  },
  {
    flag: '--channels',
    env: 'DEMO_CHANNELS',
    value: '<n>',
    default: `${PROFILE_DEFAULTS.minimal.channels} minimal, ${PROFILE_DEFAULTS.full.channels} full`,
    about: 'channels in the demo world',
  },
  {
    flag: '--seed',
    env: 'DEMO_SEED',
    value: '<n>',
    default: String(DEFAULTS.seed),
    about: 'same seed, same world',
  },
  {
    flag: '--no-worker',
    env: 'DEMO_WITH_WORKER',
    envValue: '0|1',
    value: undefined,
    default: DEFAULTS.withWorker ? '1' : '0',
    about: 'do not start the worker stages: no video reaches READY',
  },
  {
    flag: '--reset',
    env: 'DEMO_RESET',
    envValue: '1',
    value: undefined,
    default: '0',
    about: 'wipe the stack volumes and the demo state before starting',
  },
  {
    flag: '--observability',
    env: 'DEMO_OBSERVABILITY',
    envValue: '1',
    value: undefined,
    default: '0',
    about: 'also start Prometheus, Grafana, Tempo and Loki',
  },
  {
    flag: '--only',
    env: undefined,
    value: 'web|studio|api',
    default: 'all three',
    about: 'repeatable; start only these apps (api implies infra and migrate)',
  },
  {
    flag: '--api-url',
    env: 'DEMO_API_URL',
    value: '<url>',
    default: DEFAULTS.apiUrl,
    about: 'where the seed and the summary reach the API',
  },
  {
    flag: '--no-build',
    env: undefined,
    value: undefined,
    default: 'off',
    about: 'skip the image build when the images already exist',
  },
  {
    flag: '--purge-media',
    env: undefined,
    value: undefined,
    default: 'off',
    about: 'reset also deletes the generated clip cache in .demo/media',
  },
  {
    flag: '--dry-run',
    env: undefined,
    value: undefined,
    default: 'off',
    about: 'print the plan (targets, commands, URLs) and execute nothing',
  },
  { flag: '--help', env: undefined, value: undefined, default: '', about: 'show this text' },
];

export function helpText(): string {
  const rows = FLAGS.map((f) => {
    const left = [f.flag, f.value].filter(Boolean).join(' ');
    const env = f.env ? `env ${f.env}${f.envValue ? `=${f.envValue}` : ''}; ` : '';
    const dflt = f.default ? `default ${f.default}` : '';
    return `  ${left.padEnd(26)}${f.about} (${env}${dflt})`.replace(/ \(\)$/, '');
  });
  return [
    'pnpm demo [command] [options]    (make demo, make demo-seed, make demo-reset, make demo-down, make demo-status)',
    '',
    'Commands:',
    '  up (default)     start the stack, seed the demo world, print URLs and logins; safe to re-run',
    '  seed             seed the demo world into a running stack; idempotent',
    '  reset            delete the stack volumes and the demo state, then up',
    '  down             stop the containers and KEEP the data, so the next up is instant',
    `  status           the stack, the URLs and the last seed summary`,
    `  login <persona>  ${PERSONAS.map((p) => p.name).join('|')}: token, curl line and cookie one-liner`,
    '  help             this text',
    '',
    'Options (a flag wins over its env var):',
    ...rows,
    '',
    'Exit codes: 0 ok, 1 failure, 2 bad usage, 3 prerequisite missing.',
  ].join('\n');
}

type Raw = Record<string, string | boolean | string[] | undefined>;

function pick(
  raw: Raw,
  name: string,
  env: Readonly<Record<string, string | undefined>>,
  key: string
) {
  const flag = raw[name];
  return typeof flag === 'string'
    ? { value: flag, from: `--${name}` }
    : { value: env[key], from: key };
}

function integer(
  name: keyof typeof RANGES,
  source: { value: string | undefined; from: string },
  fallback: number
): Result<number, string> {
  if (source.value === undefined || source.value === '') return ok(fallback);
  const n = Number(source.value);
  const { min, max } = RANGES[name];
  if (!Number.isInteger(n) || n < min || n > max) {
    return err(`${source.from} takes a whole number from ${min} to ${max}, not "${source.value}"`);
  }
  return ok(n);
}

function toggle(source: {
  value: string | undefined;
  from: string;
}): Result<boolean | undefined, string> {
  if (source.value === undefined || source.value === '') return ok(undefined);
  if (source.value === '0' || source.value === '1') return ok(source.value === '1');
  return err(`${source.from} takes 0 or 1, not "${source.value}"`);
}

function parseUrl(value: string): Result<string, string> {
  const parsed = tryCatch(
    () => new URL(value),
    () => `--api-url takes an http(s) URL, not "${value}"`
  );
  if (!parsed.ok) return parsed;
  if (parsed.value.protocol !== 'http:' && parsed.value.protocol !== 'https:') {
    return err(`--api-url takes an http(s) URL, not "${value}"`);
  }
  return ok(value.replace(/\/+$/, ''));
}

function resolveOptions(
  raw: Raw,
  env: Readonly<Record<string, string | undefined>>
): Result<DemoRunOptions, string> {
  const profileSource = pick(raw, 'profile', env, 'DEMO_PROFILE');
  const profile = profileSource.value ?? DEFAULTS.profile;
  if (profile !== 'minimal' && profile !== 'full') {
    return err(`${profileSource.from} takes minimal or full, not "${profile}"`);
  }
  const defaults = PROFILE_DEFAULTS[profile];
  const videos = integer('videos', pick(raw, 'videos', env, 'DEMO_VIDEOS'), defaults.videos);
  const users = integer('users', pick(raw, 'users', env, 'DEMO_USERS'), defaults.users);
  const channels = integer(
    'channels',
    pick(raw, 'channels', env, 'DEMO_CHANNELS'),
    defaults.channels
  );
  const seed = integer('seed', pick(raw, 'seed', env, 'DEMO_SEED'), DEFAULTS.seed);
  if (!videos.ok) return videos;
  if (!users.ok) return users;
  if (!channels.ok) return channels;
  if (!seed.ok) return seed;
  const worker = toggle({ value: env.DEMO_WITH_WORKER, from: 'DEMO_WITH_WORKER' });
  const reset = toggle({ value: env.DEMO_RESET, from: 'DEMO_RESET' });
  const observability = toggle({ value: env.DEMO_OBSERVABILITY, from: 'DEMO_OBSERVABILITY' });
  if (!worker.ok) return worker;
  if (!reset.ok) return reset;
  if (!observability.ok) return observability;
  const apiSource = pick(raw, 'api-url', env, 'DEMO_API_URL');
  const apiUrl = parseUrl(apiSource.value || DEFAULTS.apiUrl);
  if (!apiUrl.ok) return apiUrl;
  const only = Array.isArray(raw.only) ? raw.only : [];
  const unknown = only.find((app) => !(APPS as readonly string[]).includes(app));
  if (unknown !== undefined) return err(`--only takes ${APPS.join(', ')}, not "${unknown}"`);

  return ok({
    profile,
    videos: videos.value,
    users: users.value,
    channels: channels.value,
    seed: seed.value,
    withWorker: raw['no-worker'] === true ? false : (worker.value ?? DEFAULTS.withWorker),
    reset: raw.reset === true || reset.value === true,
    observability: raw.observability === true || observability.value === true,
    only: [...new Set(only)] as DemoApp[],
    noBuild: raw['no-build'] === true,
    purgeMedia: raw['purge-media'] === true,
    apiUrl: apiUrl.value,
    workDir: DEFAULTS.workDir,
    dryRun: raw['dry-run'] === true,
  });
}

function firstLine(cause: unknown): string {
  const [line = 'bad arguments'] = String(cause).split('\n');
  return line.replace(/^TypeError( \[[A-Z_]+\])?: /, '').replace(/\.$/, '');
}

export function parseDemoCommand(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>
): Result<DemoCommand, string> {
  const parsed = tryCatch(
    () =>
      parseArgs({
        args: [...argv],
        allowPositionals: true,
        options: {
          profile: { type: 'string' },
          videos: { type: 'string' },
          users: { type: 'string' },
          channels: { type: 'string' },
          seed: { type: 'string' },
          'no-worker': { type: 'boolean' },
          reset: { type: 'boolean' },
          observability: { type: 'boolean' },
          only: { type: 'string', multiple: true },
          'api-url': { type: 'string' },
          'no-build': { type: 'boolean' },
          'purge-media': { type: 'boolean' },
          'dry-run': { type: 'boolean' },
          help: { type: 'boolean', short: 'h' },
        },
      }),
    firstLine
  );
  if (!parsed.ok) return parsed;
  const { values, positionals } = parsed.value;
  if (values.help) return ok({ kind: 'help' });
  const [kind = 'up', ...rest] = positionals;
  if (!(COMMANDS as readonly string[]).includes(kind)) {
    return err(`unknown command "${kind}"; one of ${COMMANDS.join(', ')}`);
  }
  if (kind === 'help') return ok({ kind: 'help' });
  const options = resolveOptions(values, env);
  if (!options.ok) return options;
  if (kind === 'login') {
    const [persona, ...extra] = rest;
    if (persona === undefined || findPersona(persona) === undefined || extra.length > 0) {
      return err(`login takes one persona: ${PERSONAS.map((p) => p.name).join(', ')}`);
    }
    return ok({ kind, persona, options: options.value });
  }
  if (rest.length > 0) return err(`${kind} takes no arguments, got "${rest.join(' ')}"`);
  return ok({ kind: kind as 'up' | 'seed' | 'reset' | 'down' | 'status', options: options.value });
}
