import { EXIT, runDown, runLogin, runReset, runSeed, runStatus, runUp } from '../orchestrate';
import type { SeedFn } from '../orchestrate';
import type { SeedReport } from '../types';
import { type Setup, fakeHost, optionsFrom } from './fake-host';

const REPORT = { steps: [{ scenario: 'users', status: 'done' as const, detail: '12' }] };
const BASE: Setup = {
  files: {
    '.env.example': 'ADMIN_TOKEN=change-me-32-bytes-random\n',
    '.env': 'ADMIN_TOKEN=change-me-32-bytes-random\nS3_ACCESS_KEY_ID=ak\n',
  },
};

function seeder(report: SeedReport = REPORT) {
  const calls: unknown[] = [];
  const seed: SeedFn = async (options, host) => {
    calls.push(options.seed);
    host.log('hello');
    return report;
  };
  return { seed, calls };
}

describe('demo: orchestrate up', () => {
  it('runs the five steps in order and prints the table', async () => {
    const { host, shown, text, files } = fakeHost(BASE);
    const { seed, calls } = seeder();

    expect(await runUp(host, optionsFrom(), seed)).toBe(EXIT.ok);

    expect(shown).toEqual([
      'pnpm --silent stack up api web studio worker:probe worker:transcode worker:thumbnail worker:package worker:notify worker:housekeeping worker:screen',
    ]);
    expect(calls).toEqual([1729]);
    for (const label of [
      '[1/5] prerequisites',
      '[2/5] .env',
      '[3/5] stack',
      '[4/5] seed',
      '[5/5] ready',
    ]) {
      expect(text()).toContain(label);
    }
    expect(text()).toContain('x-admin-token: change-me-32-bytes-random');
    expect(text()).toContain('ak / minioadmin');
    expect(text()).toContain('1 done, 0 skipped, 0 failed');
    expect(files.get('.demo/state.json')).toContain('"scenario": "users"');
  });

  it.each([
    {
      env: 'ADMIN_TOKEN=r3al-t0ken\nS3_SECRET_ACCESS_KEY=r2-s3cret\n',
      shows: ['see .env'],
      hides: ['r3al-t0ken', 'r2-s3cret'],
    },
    {
      env: 'ADMIN_TOKEN=change-me-1\nS3_SECRET_ACCESS_KEY=minioadmin\n',
      shows: ['change-me-1', 'minioadmin'],
      hides: ['see .env'],
    },
    { env: '', shows: ['change-me-32-bytes-random', 'minioadmin'], hides: ['see .env'] },
  ])('prints a credential only when it is a local one ($env)', async ({ env, shows, hides }) => {
    const { host, text } = fakeHost({ files: { '.env': env } });

    await runUp(host, optionsFrom(), seeder().seed);

    for (const line of shows) expect(text()).toContain(line);
    for (const line of hides) expect(text()).not.toContain(line);
  });

  it('creates .env from the example and never overwrites it', async () => {
    const created = fakeHost({ files: { '.env.example': 'A=1\n' } });
    await runUp(created.host, optionsFrom(), seeder().seed);
    expect(created.files.get('.env')).toBe('A=1\n');

    const kept = fakeHost({ files: { '.env.example': 'A=1\n', '.env': 'A=2\n' } });
    await runUp(kept.host, optionsFrom(), seeder().seed);
    expect(kept.files.get('.env')).toBe('A=2\n');
  });

  it('stops with the prerequisite exit code and the fix before touching docker compose up', async () => {
    const { host, shown, text } = fakeHost({ ...BASE, answers: { 'docker info': { code: 1 } } });
    expect(await runUp(host, optionsFrom(), seeder().seed)).toBe(EXIT.prerequisite);
    expect(shown).toEqual([]);
    expect(text()).toContain('FAIL docker');
    expect(text()).toContain('fix: ');
  });

  it('fails when .env.example is missing', async () => {
    const { host } = fakeHost();
    expect(await runUp(host, optionsFrom(), seeder().seed)).toBe(EXIT.failure);
  });

  it('fails without seeding when the stack does not come up', async () => {
    const { host } = fakeHost({ ...BASE, showCode: () => 1 });
    const { seed, calls } = seeder();
    expect(await runUp(host, optionsFrom(), seed)).toBe(EXIT.failure);
    expect(calls).toEqual([]);
  });

  it('exits 1 after the table when a seed step failed', async () => {
    const { host, text } = fakeHost(BASE);
    const failed = { steps: [{ scenario: 'videos', status: 'failed' as const, detail: 'x' }] };
    expect(await runUp(host, optionsFrom(), seeder(failed).seed)).toBe(EXIT.failure);
    expect(text()).toContain('[5/5] ready');
  });

  it.each([
    { name: 'images present', code: 0, tail: ' --no-build', note: false },
    { name: 'images missing', code: 1, tail: '', note: true },
  ])('--no-build with $name', async ({ code, tail, note }) => {
    const { host, shown, text } = fakeHost({
      ...BASE,
      answers: { 'docker image inspect': { code } },
    });
    await runUp(host, optionsFrom(['--no-build', '--no-worker']), seeder().seed);
    expect(shown[0]).toBe(`pnpm --silent stack up api web studio${tail}`);
    expect(text().includes('images are missing')).toBe(note);
  });

  it('warns about missing models on the full profile instead of failing', async () => {
    const { host, text } = fakeHost(BASE);
    expect(await runUp(host, optionsFrom(['--profile', 'full']), seeder().seed)).toBe(EXIT.ok);
    expect(text()).toContain('pnpm models:fetch');
  });

  it('does not warn about models when they are present', async () => {
    const models = Object.fromEntries(
      [
        '.models/ggml-small-q5_1.bin',
        '.models/ggml-silero-v5.1.2.bin',
        '.models/vit-base-nsfw-detector-int8.onnx',
      ].map((m) => [m, 'x'])
    );
    const { host, text } = fakeHost({ files: { ...BASE.files, ...models } });
    await runUp(host, optionsFrom(['--profile', 'full']), seeder().seed);
    expect(text()).not.toContain('models:fetch');
  });

  it('executes nothing on --dry-run', async () => {
    const { host, shown, captured, files, text } = fakeHost();
    const { seed, calls } = seeder();
    expect(await runUp(host, optionsFrom(['--dry-run']), seed)).toBe(EXIT.ok);
    expect([shown, captured, calls, [...files.keys()]]).toEqual([[], [], [], []]);
    expect(text()).toContain('Plan for pnpm demo up');
  });

  it('wipes the stack and the state first on --reset, keeping the media cache', async () => {
    const { host, shown, removed } = fakeHost({
      files: { ...BASE.files, '.demo/media/a.mp4': 'x' },
    });
    await runUp(host, optionsFrom(['--reset', '--no-worker']), seeder().seed);
    expect(shown[0]).toBe('pnpm --silent stack down');
    expect(shown[1]).toContain('stack up');
    expect(removed).toEqual(['.demo/state.json']);
  });
});

describe('demo: orchestrate other commands', () => {
  it('reset deletes the volumes, the state and with --purge-media the clips, then brings it up', async () => {
    const { host, shown, removed } = fakeHost(BASE);
    expect(await runReset(host, optionsFrom(['--purge-media', '--no-worker']), seeder().seed)).toBe(
      EXIT.ok
    );
    expect(shown).toEqual(['pnpm --silent stack down', 'pnpm --silent stack up api web studio']);
    expect(removed).toEqual(['.demo/state.json', '.demo/media']);
  });

  it('reset stops when the stack will not go down', async () => {
    const { host, shown } = fakeHost({ ...BASE, showCode: () => 1 });
    expect(await runReset(host, optionsFrom(), seeder().seed)).toBe(EXIT.failure);
    expect(shown).toHaveLength(1);
  });

  it('seed refuses to run against an API that does not answer', async () => {
    const { host, text } = fakeHost({ httpOk: false });
    const { seed, calls } = seeder();
    expect(await runSeed(host, optionsFrom(), seed)).toBe(EXIT.failure);
    expect(calls).toEqual([]);
    expect(text()).toContain('/healthz');
  });

  it('seed runs the world and records it', async () => {
    const { host, files } = fakeHost();
    expect(await runSeed(host, optionsFrom(), seeder().seed)).toBe(EXIT.ok);
    expect(files.has('.demo/state.json')).toBe(true);
  });

  it('down stops without deleting volumes', async () => {
    const { host, shown, text } = fakeHost();
    expect(await runDown(host, optionsFrom())).toBe(EXIT.ok);
    expect(shown).toEqual(['docker compose -f infra/compose/docker-compose.yml --profile * stop']);
    expect(text()).toContain('data is kept');
  });

  it('status shows the stack, the table and the last seed', async () => {
    const seeded = fakeHost(BASE);
    await runSeed(seeded.host, optionsFrom(), seeder().seed);
    const { host, shown, text } = fakeHost({ files: Object.fromEntries(seeded.files) });
    expect(await runStatus(host, optionsFrom())).toBe(EXIT.ok);
    expect(shown).toEqual(['pnpm --silent stack status']);
    expect(text()).toContain('Last seed');
  });

  it('status says so when nothing was seeded', async () => {
    const { host, text } = fakeHost();
    await runStatus(host, optionsFrom());
    expect(text()).toContain('Not seeded yet');
  });

  it('login prints the persona sign-in, or fails when no token is minted', async () => {
    const ok = fakeHost({ answers: { 'pnpm --silent dev-token': { stdout: 'TOKEN\n' } } });
    expect(await runLogin(ok.host, optionsFrom(), 'creator')).toBe(EXIT.ok);
    expect(ok.text()).toContain('Authorization: Bearer TOKEN');
    expect(ok.text()).toContain('vp.session=TOKEN');

    const broken = fakeHost({
      answers: { 'pnpm --silent dev-token': { code: 1, stderr: 'boom' } },
    });
    expect(await runLogin(broken.host, optionsFrom(), 'creator')).toBe(EXIT.failure);
    expect(await runLogin(broken.host, optionsFrom(), 'nobody')).toBe(EXIT.usage);
  });
});
