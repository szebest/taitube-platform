import { run } from '../cli';
import { fakeHost } from './fake-host';

const seed = async () => ({ steps: [] });

describe('demo: cli', () => {
  it.each([
    { argv: ['--help'], code: 0, text: 'Exit codes' },
    { argv: ['help'], code: 0, text: 'pnpm demo [command]' },
    { argv: ['launch'], code: 2, text: 'unknown command "launch"' },
    { argv: ['--videos', 'x'], code: 2, text: '--videos takes a whole number' },
    { argv: ['login', 'nobody'], code: 2, text: 'login takes one persona' },
    { argv: ['up', '--dry-run'], code: 0, text: 'Plan for pnpm demo up' },
    { argv: ['--dry-run', 'reset'], code: 0, text: 'Plan for pnpm demo reset' },
    { argv: ['seed', '--dry-run'], code: 0, text: 'Plan for pnpm demo seed' },
    { argv: ['down', '--dry-run'], code: 0, text: 'Plan for pnpm demo down' },
    { argv: ['status', '--dry-run'], code: 0, text: 'Plan for pnpm demo status' },
    { argv: ['login', 'admin', '--dry-run'], code: 0, text: 'Plan for pnpm demo login' },
  ])('$argv exits $code', async ({ argv, code, text }) => {
    const { host, text: out } = fakeHost();
    expect(await run(argv, host, seed)).toBe(code);
    expect(out()).toContain(text);
  });

  it('reads the options from the host environment', async () => {
    const { host, text } = fakeHost({ env: { DEMO_VIDEOS: '3' } });
    await run(['--dry-run'], host, seed);
    expect(text()).toContain('seed 3 videos');
  });
});
