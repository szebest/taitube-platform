import { PERSONAS } from './logins';
import type { DemoProfile } from './types';

export const COMMANDS = ['up', 'seed', 'reset', 'down', 'status', 'login', 'help'] as const;

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
