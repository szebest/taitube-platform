import { DEFAULTS, FLAGS, PROFILE_DEFAULTS, helpText, parseDemoCommand } from '../options';
import { optionsFrom } from './fake-host';

describe('demo: options', () => {
  it('defaults every option from one table', () => {
    expect(optionsFrom()).toEqual({
      profile: 'minimal',
      ...PROFILE_DEFAULTS.minimal,
      seed: 1729,
      withWorker: true,
      reset: false,
      observability: false,
      only: [],
      noBuild: false,
      purgeMedia: false,
      apiUrl: DEFAULTS.apiUrl,
      workDir: '.demo',
      dryRun: false,
    });
  });

  it('takes the counts of the full profile', () => {
    expect(optionsFrom(['--profile', 'full'])).toMatchObject(PROFILE_DEFAULTS.full);
  });

  it.each([
    { argv: ['--videos', '3'], env: {}, expected: { videos: 3 } },
    { argv: [], env: { DEMO_VIDEOS: '5' }, expected: { videos: 5 } },
    { argv: ['--videos', '3'], env: { DEMO_VIDEOS: '5' }, expected: { videos: 3 } },
    { argv: [], env: { DEMO_PROFILE: 'full' }, expected: { profile: 'full', videos: 24 } },
    {
      argv: [],
      env: { DEMO_SEED: '7', DEMO_USERS: '2', DEMO_CHANNELS: '1' },
      expected: { seed: 7, users: 2, channels: 1 },
    },
    { argv: [], env: { DEMO_WITH_WORKER: '0' }, expected: { withWorker: false } },
    { argv: ['--no-worker'], env: { DEMO_WITH_WORKER: '1' }, expected: { withWorker: false } },
    {
      argv: [],
      env: { DEMO_RESET: '1', DEMO_OBSERVABILITY: '1' },
      expected: { reset: true, observability: true },
    },
    {
      argv: ['--only', 'web', '--only', 'api', '--only', 'web'],
      env: {},
      expected: { only: ['web', 'api'] },
    },
    {
      argv: ['--api-url', 'http://localhost:4000/'],
      env: {},
      expected: { apiUrl: 'http://localhost:4000' },
    },
    { argv: ['--no-build', '--dry-run'], env: {}, expected: { noBuild: true, dryRun: true } },
  ])('resolves $argv with $env', ({ argv, env, expected }) => {
    expect(optionsFrom(argv, env)).toMatchObject(expected);
  });

  it.each([
    { argv: ['--profile', 'huge'], error: '--profile takes minimal or full' },
    { argv: ['--videos', 'many'], error: '--videos takes a whole number from 0 to 200' },
    { argv: ['--users', '0'], error: '--users takes a whole number from 1 to 1000' },
    { argv: ['--seed=-1'], error: '--seed takes a whole number' },
    { argv: ['--only', 'db'], error: '--only takes web, studio, api, not "db"' },
    { argv: ['--api-url', 'ftp://x'], error: '--api-url takes an http(s) URL' },
    { argv: ['--api-url', 'nope'], error: '--api-url takes an http(s) URL' },
    { argv: ['--bogus'], error: 'Unknown option' },
    { argv: ['launch'], error: 'unknown command "launch"' },
    { argv: ['login'], error: 'login takes one persona' },
    { argv: ['login', 'god'], error: 'login takes one persona' },
    { argv: ['down', 'extra'], error: 'down takes no arguments' },
  ])('rejects $argv', ({ argv, error }) => {
    const parsed = parseDemoCommand(argv, {});
    expect(parsed.ok ? '' : parsed.error).toContain(error);
  });

  it.each([
    { env: { DEMO_PROFILE: 'x' }, error: 'DEMO_PROFILE takes minimal or full' },
    { env: { DEMO_VIDEOS: '-2' }, error: 'DEMO_VIDEOS takes a whole number' },
    { env: { DEMO_WITH_WORKER: 'yes' }, error: 'DEMO_WITH_WORKER takes 0 or 1' },
    { env: { DEMO_RESET: '2' }, error: 'DEMO_RESET takes 0 or 1' },
  ])('rejects the env $env', ({ env, error }) => {
    const parsed = parseDemoCommand([], env);
    expect(parsed.ok ? '' : parsed.error).toContain(error);
  });

  it.each([
    { argv: [], kind: 'up' },
    { argv: ['seed'], kind: 'seed' },
    { argv: ['reset'], kind: 'reset' },
    { argv: ['--help'], kind: 'help' },
    { argv: ['help'], kind: 'help' },
    { argv: ['login', 'admin'], kind: 'login' },
  ])('reads the command of $argv as $kind', ({ argv, kind }) => {
    const parsed = parseDemoCommand(argv, {});
    expect(parsed.ok && parsed.value.kind).toBe(kind);
  });

  it('prints every flag and env var in the help', () => {
    const help = helpText();
    for (const flag of FLAGS) {
      expect(help).toContain(flag.flag);
      if (flag.env) expect(help).toContain(flag.env);
    }
  });
});
