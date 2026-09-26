import { down, status, up } from '../stack';
import { fakeDocker, psRow } from './fake-docker';

const OPTIONS = { build: true, waitTimeoutSec: 90 };
const WAIT = '--detach --no-build --wait --wait-timeout 90';

describe('packages/stack: up', () => {
  it('builds what it starts, then starts it a tier at a time, waiting out each one-shot', async () => {
    const docker = fakeDocker();

    expect(await up(docker.host, ['web'], OPTIONS)).toBe(0);
    expect(docker.subcommands()).toEqual([
      'config --profiles',
      'config --format json',
      'build migrate api web',
      `up ${WAIT} postgres`,
      `up ${WAIT} migrate`,
      'ps --all --quiet migrate',
      `up ${WAIT} api`,
      `up ${WAIT} web`,
      'ps --all --format json postgres migrate api web',
    ]);
  });

  it('enables only the profiles of what it starts, on every compose call after the listing', async () => {
    const docker = fakeDocker();

    await up(docker.host, ['api'], OPTIONS);

    expect(docker.calls[0]).toEqual(['compose', '-f', 'compose.yml', 'config', '--profiles']);
    expect(docker.calls.at(-1)?.slice(0, 7)).toEqual([
      'compose',
      '-f',
      'compose.yml',
      '--profile',
      'api',
      '--profile',
      'migrate',
    ]);
  });

  it('skips the build when told to, and starts the infrastructure alone for no target', async () => {
    const docker = fakeDocker();

    expect(await up(docker.host, [], { ...OPTIONS, build: false })).toBe(0);
    expect(docker.subcommands()).toEqual([
      'config --profiles',
      'config --format json',
      `up ${WAIT} postgres`,
      'ps --all --format json postgres',
    ]);
  });

  it('prints the service table when everything is up', async () => {
    const docker = fakeDocker({
      ps: {
        stdout: [
          psRow('api', { Publishers: [{ PublishedPort: 3000 }] }),
          psRow('migrate', { State: 'exited', Health: '' }),
        ].join('\n'),
      },
    });

    await up(docker.host, ['api'], OPTIONS);

    expect(docker.printed.at(-1)).toContain('api      running (healthy)  http://localhost:3000');
  });

  it('names the service that failed and prints its logs, then stops', async () => {
    const docker = fakeDocker({
      wait: (ids) => ({ stdout: ids.map(() => '3').join('\n') }),
      ps: (args) => ({
        stdout: args.includes('--quiet')
          ? 'c0ffee\n'
          : [
              psRow('postgres'),
              psRow('migrate', { State: 'exited', Health: '', ExitCode: 3 }),
            ].join('\n'),
      }),
      logs: (args) => ({ stdout: `logs of ${args.at(-1)}: relation "videos" already exists\n` }),
    });

    expect(await up(docker.host, ['web'], OPTIONS)).toBe(1);
    expect(docker.subcommands()).toContain('wait c0ffee');
    expect(docker.subcommands().at(-1)).toBe('logs --no-color --no-log-prefix --tail 40 migrate');
    expect(docker.printed).toEqual([
      '\nmigrate failed: exited (3). Its last 40 lines:',
      'logs of migrate: relation "videos" already exists',
    ]);
  });

  it('says so when compose failed and no container explains why', async () => {
    const docker = fakeDocker({
      up: { code: 1 },
      ps: { stdout: psRow('postgres', { Health: 'starting' }) },
    });

    expect(await up(docker.host, ['api'], OPTIONS)).toBe(1);
    expect(docker.printed).toEqual([
      'Failed to start: postgres. No container reported why; see the output above.',
    ]);
  });

  it.each([
    {
      stage: 'build',
      answers: { build: { code: 2 } },
      code: 2,
      printed: 'Building migrate, api failed.',
    },
    {
      stage: 'targets',
      answers: {},
      code: 2,
      printed: 'Unknown target "nope".',
      targets: ['nope'],
    },
    {
      stage: 'config',
      answers: { 'config --profiles': { code: 14, stderr: 'env file .env not found\n' } },
      code: 1,
      printed: 'docker compose could not read compose.yml:\nenv file .env not found',
    },
  ])('refuses at the $stage stage', async ({ answers, code, printed, targets = ['api'] }) => {
    const docker = fakeDocker(answers);

    expect(await up(docker.host, targets, OPTIONS)).toBe(code);
    expect(docker.printed).toEqual([printed]);
    expect(docker.subcommands().some((call) => call.startsWith('up'))).toBe(false);
  });
});

describe('packages/stack: down and status', () => {
  it('stops every profile and deletes the volumes', async () => {
    const docker = fakeDocker();

    await down(docker.host);

    expect(docker.calls.at(-1)).toEqual([
      'compose',
      '-f',
      'compose.yml',
      ...['api', 'migrate', 'observability', 'web'].flatMap((p) => ['--profile', p]),
      ...['down', '--volumes', '--remove-orphans', '--timeout', '1'],
    ]);
  });

  it.each([
    {
      stdout: psRow('api'),
      printed: 'SERVICE  STATE              URL\napi      running (healthy)',
    },
    { stdout: '', printed: 'Nothing is running.' },
  ])('prints $printed', async ({ stdout, printed }) => {
    const docker = fakeDocker({ ps: { stdout } });

    expect(await status(docker.host)).toBe(0);
    expect(docker.printed).toEqual([printed]);
  });
});
