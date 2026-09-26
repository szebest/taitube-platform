import { parseTopology, profilesOf, selectServices, tiers } from '../topology';

const started = { condition: 'service_started' };
const healthy = { condition: 'service_healthy' };
const completed = { condition: 'service_completed_successfully' };
const app = { context: '../..', dockerfile: 'Dockerfile' };

const CONFIG = JSON.stringify({
  name: 'video-pipeline',
  services: {
    postgres: { image: 'postgres:16-alpine' },
    minio: { image: 'minio' },
    'minio-init': { image: 'mc', depends_on: { minio: started } },
    migrate: { build: app, profiles: ['migrate'], depends_on: { postgres: healthy } },
    api: {
      build: app,
      profiles: ['api'],
      depends_on: { postgres: healthy, 'minio-init': completed, migrate: completed },
    },
    web: { build: app, profiles: ['web'], depends_on: { api: healthy } },
    'worker-probe': { build: app, profiles: ['worker'], depends_on: { migrate: completed } },
    'worker-transcode-720p': {
      build: app,
      profiles: ['worker'],
      depends_on: { migrate: completed },
    },
    'worker-transcode-1080p': {
      build: app,
      profiles: ['worker'],
      depends_on: { migrate: completed },
    },
    grafana: { image: 'grafana', profiles: ['observability'] },
  },
});

const topology = parseTopology(CONFIG);

const selected = (...targets: string[]) => {
  const result = selectServices(topology, targets);
  return result.ok ? [...result.value].sort() : result.error;
};

describe('packages/stack: topology', () => {
  it('reads each service, which ones others wait on to exit, and which ones are built here', () => {
    expect(topology.get('api')).toEqual({
      name: 'api',
      profiles: ['api'],
      dependsOn: ['postgres', 'minio-init', 'migrate'],
      built: true,
      oneShot: false,
    });
    expect(topology.get('minio-init')).toMatchObject({ oneShot: true, built: false, profiles: [] });
    expect(topology.get('migrate')).toMatchObject({ oneShot: true, built: true });
  });

  it.each([
    { targets: [], expected: ['minio', 'minio-init', 'postgres'] },
    { targets: ['api'], expected: ['api'] },
    { targets: ['api', 'web'], expected: ['api', 'web'] },
    {
      targets: ['worker'],
      expected: ['worker-probe', 'worker-transcode-1080p', 'worker-transcode-720p'],
    },
    {
      targets: ['worker:transcode'],
      expected: ['worker-transcode-1080p', 'worker-transcode-720p'],
    },
    { targets: ['worker:transcode-720p'], expected: ['worker-transcode-720p'] },
    { targets: ['worker:probe'], expected: ['worker-probe'] },
    { targets: ['postgres'], expected: ['postgres'] },
    { targets: ['observability'], expected: ['grafana'] },
    {
      targets: ['all'],
      expected: [
        'api',
        'migrate',
        'minio',
        'minio-init',
        'postgres',
        'web',
        'worker-probe',
        'worker-transcode-1080p',
        'worker-transcode-720p',
      ],
    },
  ])('selects $targets as $expected', ({ targets, expected }) => {
    expect(selected(...targets)).toEqual(expected);
  });

  it.each(['nope', 'worker:nope', 'api:x'])('refuses the unknown target %s', (target) => {
    expect(selected('api', target)).toEqual({ unknownTarget: target });
  });

  it('orders what a service needs into tiers that depend only on earlier ones', () => {
    expect(tiers(topology, ['web', 'worker-probe'])).toEqual([
      ['minio', 'postgres'],
      ['migrate', 'minio-init'],
      ['api', 'worker-probe'],
      ['web'],
    ]);
  });

  it('enables the profiles of every service it starts, dependencies included', () => {
    const [, ...rest] = tiers(topology, ['web']);

    expect(profilesOf(topology, rest.flat())).toEqual(['api', 'migrate', 'web']);
  });
});
