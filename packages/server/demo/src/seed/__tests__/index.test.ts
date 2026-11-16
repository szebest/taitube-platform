import { createFakeApi, runSeed } from './fake-seed';

describe('seed/index: seedDemo', () => {
  it('seeds the whole world on a first run, one line per step', async () => {
    const api = createFakeApi();

    const { report, lines } = await runSeed(api);

    expect(report.steps.map((step) => `${step.status} ${step.scenario}`)).toEqual([
      'done identities',
      'done categories',
      'done channels',
      'done channel-images',
      'done media',
      'done videos',
      'done captions',
      'done comments',
      'done reactions',
      'done subscriptions',
      'done playlists',
      'done history',
      'done searches',
      'done reports',
      'done featured',
    ]);
    expect(lines.filter((line) => /^(done|skipped|failed) /.test(line))).toHaveLength(15);
    expect(api.count().videos).toBe(6);
    expect(api.count().comments).toBeGreaterThan(6);
  });

  it('adds nothing when it runs again on the same world', async () => {
    const api = createFakeApi();
    await runSeed(api);
    const before = JSON.stringify(api.count());

    const { report } = await runSeed(api);

    expect(JSON.stringify(api.count())).toBe(before);
    expect(report.steps.filter((step) => step.status !== 'done')).toEqual([]);
    expect(report.steps.find((step) => step.scenario === 'videos')?.detail).toMatch(
      /^0 videos created, 6 already there/
    );
    expect(report.steps.find((step) => step.scenario === 'reports')?.detail).toMatch(
      /^0 comment reports created, 2 already there/
    );
  });

  it('skips a scenario whose routes are not in the contract, and never fails the run on it', async () => {
    const { report, lines } = await runSeed(
      createFakeApi(),
      {},
      {
        routes: { has: (route) => !route.includes('/playlists') },
      }
    );

    expect(report.steps.find((step) => step.scenario === 'playlists')).toEqual({
      scenario: 'playlists',
      status: 'skipped',
      detail: 'needs GET /v1/me/playlists (not in this build)',
    });
    expect(lines).toContain('skipped playlists: needs GET /v1/me/playlists (not in this build)');
    expect(report.steps.filter((step) => step.status === 'failed')).toEqual([]);
  });

  it('treats a 404 on an optional route at run time as a skip', async () => {
    const { report } = await runSeed(createFakeApi({ disabled: ['PUT /v1/videos'] }));

    expect(report.steps.find((step) => step.scenario === 'captions')?.status).toBe('skipped');
    expect(report.steps.find((step) => step.scenario === 'comments')?.status).toBe('done');
  });

  it('leaves the worker steps out when the worker is off', async () => {
    const api = createFakeApi();

    const { report, lines } = await runSeed(api, { withWorker: false });

    expect(
      report.steps.filter((step) => step.status === 'skipped').map((step) => step.scenario)
    ).toEqual(['captions', 'comments', 'reactions', 'playlists', 'history', 'reports', 'featured']);
    expect(report.steps.find((step) => step.scenario === 'subscriptions')?.status).toBe('done');
    expect(api.count().videos).toBe(6);
    expect(lines.some((line) => line.includes('not waiting for READY'))).toBe(true);
  });

  it('stops after a failed essential step and says so for the rest', async () => {
    const api = createFakeApi({ disabled: ['GET /v1/me/account'] });

    const { report } = await runSeed(api);
    const byName = new Map(report.steps.map((step) => [step.scenario, step]));

    expect(byName.get('channels')?.status).toBe('skipped');
    expect(byName.get('identities')?.status).toBe('done');
  });

  it('retries an upload the rate limit refused', async () => {
    const { report, ports } = await runSeed(createFakeApi({ failUploads: 2 }));

    expect(report.steps.find((step) => step.scenario === 'videos')?.status).toBe('done');
    expect(ports.slept.length).toBeGreaterThan(0);
  });

  it('refuses to run in production', async () => {
    const lines: string[] = [];
    const { seedDemo } = await import('../index');
    const { SMALL } = await import('./fake-seed');

    const report = await seedDemo(SMALL, {
      log: (line) => lines.push(line),
      environment: 'production',
    });

    expect(report.steps).toEqual([
      {
        scenario: 'guard',
        status: 'failed',
        detail: 'refuses NODE_ENV=production: the seed is demo data',
      },
    ]);
  });

  it('plans without touching anything on a dry run', async () => {
    const api = createFakeApi();

    const { report, ports } = await runSeed(api, { dryRun: true });

    expect(
      report.steps.every((step) => step.status === 'skipped' && step.detail === 'dry run')
    ).toBe(true);
    expect(api.calls).toEqual([]);
    expect(ports.identityRows).toEqual([]);
  });
});
