import { run } from '../cli';
import { fakeDocker } from './fake-docker';

describe('packages/stack: cli', () => {
  it('reads the compose files, the build switch and the wait timeout', async () => {
    const docker = fakeDocker();

    const code = await run(
      ['up', 'api', '-f', 'a.yml', '--file', 'b.yml', '--no-build', '--wait-timeout', '30'],
      docker.host
    );

    expect(code).toBe(0);
    expect(docker.calls[0]).toEqual([
      ...['compose', '-f', 'a.yml', '-f', 'b.yml', '--profile', '*'],
      ...['config', '--format', 'json'],
    ]);
    expect(docker.subcommands()).not.toContain('build migrate api');
    expect(docker.subcommands()).toContain('up --detach --no-build --wait --wait-timeout 30 api');
  });

  it('reads infra/compose/docker-compose.yml when given no file', async () => {
    const docker = fakeDocker();

    await run(['status'], docker.host);

    expect(docker.calls[0]?.slice(0, 3)).toEqual([
      'compose',
      '-f',
      'infra/compose/docker-compose.yml',
    ]);
  });

  it.each([
    { argv: ['down'], code: 0, last: 'down --volumes --remove-orphans --timeout 1' },
    { argv: ['--help'], code: 0, last: undefined },
    { argv: ['launch'], code: 2, last: undefined },
    { argv: [], code: 2, last: undefined },
  ])('$argv exits $code', async ({ argv, code, last }) => {
    const docker = fakeDocker();

    expect(await run(argv, docker.host)).toBe(code);
    expect(docker.subcommands().at(-1)).toBe(last);
    if (last === undefined) expect(docker.printed[0]).toContain('pnpm stack <command>');
  });

  it.each([
    {
      argv: ['up', '--wait-timeout', 'abc'],
      printed: '--wait-timeout takes whole seconds above 0, not "abc".',
    },
    {
      argv: ['up', '--wait-timeout', '0'],
      printed: '--wait-timeout takes whole seconds above 0, not "0".',
    },
    {
      argv: ['up', '--detach'],
      printed:
        "TypeError [ERR_PARSE_ARGS_UNKNOWN_OPTION]: Unknown option '--detach'. See pnpm stack --help.",
    },
    {
      argv: ['up', '--file'],
      printed: expect.stringMatching(
        /^TypeError \[ERR_PARSE_ARGS_INVALID_OPTION_VALUE\]: Option '-f, --file <value>' argument missing[^\n]*$/
      ),
    },
  ])('$argv prints one line and exits 2 without calling docker', async ({ argv, printed }) => {
    const docker = fakeDocker();

    expect(await run(argv, docker.host)).toBe(2);
    expect(docker.printed).toEqual([printed]);
    expect(docker.calls).toEqual([]);
  });
});
