import { planLines, render, seedLine } from '../plan';
import { CREDENTIAL_FALLBACKS, endpoints } from '../urls';
import { fakeHost, optionsFrom } from './fake-host';

const plan = (kind: Parameters<typeof planLines>[0], argv: string[] = [], persona?: string) => {
  const options = optionsFrom(argv);
  return planLines(kind, options, endpoints(options, CREDENTIAL_FALLBACKS), persona).join('\n');
};

describe('demo: plan', () => {
  it('renders a command on one line', () => {
    expect(render({ command: 'pnpm', args: ['--silent', 'stack', 'down'] })).toBe(
      'pnpm --silent stack down'
    );
  });

  it('describes the seed', () => {
    expect(seedLine(optionsFrom(['--no-worker']))).toContain('rows only, no worker');
    expect(seedLine(optionsFrom())).toBe(
      'seed 8 videos, 12 users, 4 channels, seed 1729, through the worker pipeline'
    );
  });

  it.each([
    {
      kind: 'up' as const,
      argv: [],
      expected: [
        'pnpm --silent stack up api web studio worker:probe',
        '1 prerequisites',
        'Web http://localhost:5173',
      ],
    },
    {
      kind: 'up' as const,
      argv: ['--no-build', '--profile', 'full'],
      expected: ['stack up all --no-build', 'Live RTMP'],
    },
    {
      kind: 'reset' as const,
      argv: ['--purge-media'],
      expected: ['stack down', 'remove .demo/state.json and .demo/media', 'stack up'],
    },
    { kind: 'seed' as const, argv: [], expected: ['seed 8 videos', '.demo/state.json'] },
    {
      kind: 'down' as const,
      argv: [],
      expected: ['docker compose -f infra/compose/docker-compose.yml --profile * stop'],
    },
    { kind: 'status' as const, argv: [], expected: ['pnpm --silent stack status'] },
  ])('plans $kind', ({ kind, argv, expected }) => {
    const text = plan(kind, argv);
    for (const part of expected) expect(text).toContain(part);
    expect(text).toContain('dry run');
  });

  it('plans the token mint for a persona', () => {
    expect(plan('login', [], 'moderator')).toContain('--role moderator');
    expect(plan('login', [], 'nobody')).toContain('no persona');
    expect(fakeHost().host.cwd).toBe('/repo');
  });
});
