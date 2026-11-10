import { checkPrerequisites, hintFor, parseListeners, platformKind } from '../prereqs';
import { type Setup, fakeHost, optionsFrom } from './fake-host';

const failing = async (setup: Setup) =>
  (await checkPrerequisites(fakeHost(setup).host, optionsFrom())).filter((c) => !c.ok);

describe('demo: prereqs', () => {
  it('passes on a healthy machine', async () => {
    const checks = await checkPrerequisites(fakeHost().host, optionsFrom());
    expect(checks.map((c) => c.id)).toEqual([
      'node',
      'pnpm',
      'docker',
      'compose',
      'ffmpeg',
      'disk',
      'ports',
    ]);
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it.each([
    { name: 'node 22', setup: { nodeVersion: 'v22.1.0' }, id: 'node' },
    { name: 'pnpm 10', setup: { answers: { 'pnpm -v': { stdout: '10.1.0' } } }, id: 'pnpm' },
    { name: 'pnpm missing', setup: { answers: { 'pnpm -v': { code: 127 } } }, id: 'pnpm' },
    { name: 'daemon down', setup: { answers: { 'docker info': { code: 1 } } }, id: 'docker' },
    {
      name: 'compose v1',
      setup: { answers: { 'docker compose version': { stdout: '1.29.2' } } },
      id: 'compose',
    },
    { name: 'no ffmpeg', setup: { answers: { 'ffmpeg -version': { code: 127 } } }, id: 'ffmpeg' },
    {
      name: 'disk full',
      setup: {
        answers: { 'pnpm --silent preflight': { code: 1, stderr: 'preflight: 2 GiB free' } },
      },
      id: 'disk',
    },
  ])('fails the $id check on $name, with a hint', async ({ setup, id }) => {
    const failed = await failing(setup);
    expect(failed.map((c) => c.id)).toEqual([id]);
    expect(failed[0]?.hint).not.toBe('');
  });

  it('names the process holding a port that is not this stack', async () => {
    const failed = await failing({
      answers: { lsof: { stdout: 'p123\ncnode\nn*:5173\n' }, 'docker compose': { stdout: '' } },
    });
    expect(failed[0]).toMatchObject({ id: 'ports', detail: '5173 by node (pid 123)' });
  });

  it('accepts a port that a container of this stack publishes', async () => {
    const ps = JSON.stringify({ Service: 'web', Publishers: [{ PublishedPort: 5173 }] });
    const failed = await failing({
      answers: {
        lsof: { stdout: 'p9\ncom.docker.backend\nn*:5173\n' },
        'docker compose': { stdout: `${ps}\n` },
      },
    });
    expect(failed).toEqual([]);
  });

  it('skips the port check without lsof', async () => {
    const failed = await failing({ answers: { lsof: { code: 127 } } });
    expect(failed).toEqual([]);
  });

  it.each([
    { platform: 'darwin' as const, env: {}, kind: 'macos' },
    { platform: 'linux' as const, env: {}, kind: 'linux' },
    { platform: 'linux' as const, env: { WSL_DISTRO_NAME: 'Ubuntu' }, kind: 'wsl' },
  ])('reads $kind from $platform and $env', ({ platform, env, kind }) => {
    expect(platformKind({ platform, env })).toBe(kind);
  });

  it.each([
    { kind: 'macos' as const, text: 'colima' },
    { kind: 'linux' as const, text: 'systemctl' },
    { kind: 'wsl' as const, text: 'WSL integration' },
  ])('hints the docker fix for $kind', ({ kind, text }) => {
    expect(hintFor({ id: 'docker' }, kind)).toContain(text);
  });

  it('parses lsof field output', () => {
    expect(
      parseListeners('p1\ncnode\nn*:3000\nn[::1]:3000\np2\ncpostgres\nn127.0.0.1:5432\n')
    ).toEqual([
      { port: 3000, pid: '1', name: 'node' },
      { port: 3000, pid: '1', name: 'node' },
      { port: 5432, pid: '2', name: 'postgres' },
    ]);
  });
});
