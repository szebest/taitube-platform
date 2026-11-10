import { stackTargets, stackUp, requiredPorts } from '../targets';
import { optionsFrom } from './fake-host';

const CORE = [
  'worker:probe',
  'worker:transcode',
  'worker:thumbnail',
  'worker:package',
  'worker:notify',
  'worker:housekeeping',
];

describe('demo: targets', () => {
  it.each([
    { argv: [], targets: ['api', 'web', 'studio', ...CORE] },
    { argv: ['--no-worker'], targets: ['api', 'web', 'studio'] },
    { argv: ['--profile', 'full'], targets: ['all'] },
    { argv: ['--profile', 'full', '--observability'], targets: ['all', 'observability'] },
    { argv: ['--profile', 'full', '--no-worker'], targets: ['api', 'web', 'studio'] },
    { argv: ['--only', 'web'], targets: ['web'] },
    { argv: ['--only', 'api'], targets: ['api', ...CORE] },
    { argv: ['--only', 'studio', '--only', 'api', '--no-worker'], targets: ['studio', 'api'] },
    { argv: ['--observability'], targets: ['api', 'web', 'studio', ...CORE, 'observability'] },
  ])('picks $targets for $argv', ({ argv, targets }) => {
    expect(stackTargets(optionsFrom(argv))).toEqual(targets);
  });

  it.each([
    { build: true, tail: [] },
    { build: false, tail: ['--no-build'] },
  ])('passes the build switch through (build $build)', ({ build, tail }) => {
    expect(stackUp(optionsFrom(['--no-worker']), build).args).toEqual([
      ...['--silent', 'stack', 'up', 'api', 'web', 'studio'],
      ...tail,
    ]);
  });

  it.each([
    { argv: [], ports: [3000, 5173, 5174, 5432, 6379, 9000, 9001] },
    { argv: ['--only', 'web'], ports: [5173, 5432, 6379, 9000, 9001] },
    { argv: ['--observability'], ports: [3000, 3001, 5173, 5174, 5432, 6379, 9000, 9001] },
  ])('needs ports $ports for $argv', ({ argv, ports }) => {
    expect(requiredPorts(optionsFrom(argv))).toEqual(ports);
  });
});
