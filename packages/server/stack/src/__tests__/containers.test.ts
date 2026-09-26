import { type Container, formatTable, hasFailed, parseContainers } from '../containers';

const row = (fields: Record<string, unknown>) =>
  JSON.stringify({
    Service: 'api',
    State: 'running',
    Health: '',
    ExitCode: 0,
    Publishers: [],
    ...fields,
  });

const container = (fields: Partial<Container>): Container => ({
  service: 'api',
  state: 'running',
  health: '',
  exitCode: 0,
  urls: [],
  ...fields,
});

describe('packages/stack: containers', () => {
  it('reads one object per line and turns published ports into URLs, once per port', () => {
    const output = [
      row({
        Health: 'healthy',
        Publishers: [
          { URL: '0.0.0.0', TargetPort: 9464, PublishedPort: 9464 },
          { URL: '0.0.0.0', TargetPort: 3000, PublishedPort: 3000 },
          { URL: '::', TargetPort: 3000, PublishedPort: 3000 },
          { URL: '', TargetPort: 8080, PublishedPort: 0 },
        ],
      }),
      row({ Service: 'migrate', State: 'exited', Publishers: null }),
    ].join('\n');

    expect(parseContainers(output)).toEqual([
      container({ health: 'healthy', urls: ['http://localhost:3000', 'http://localhost:9464'] }),
      container({ service: 'migrate', state: 'exited' }),
    ]);
  });

  it.each([
    { format: 'an array', output: `[${row({})}]` },
    { format: 'nothing', output: '\n' },
  ])('reads $format as older Compose prints it', ({ output }) => {
    expect(parseContainers(output)).toEqual(output.trim() === '' ? [] : [container({})]);
  });

  it.each([
    { state: 'exited', exitCode: 0, oneShot: true, failed: false },
    { state: 'exited', exitCode: 1, oneShot: true, failed: true },
    { state: 'exited', exitCode: 0, oneShot: false, failed: true },
    { state: 'running', health: 'unhealthy', oneShot: false, failed: true },
    { state: 'running', health: 'starting', oneShot: false, failed: false },
    { state: 'restarting', oneShot: false, failed: true },
    { state: 'created', oneShot: false, failed: false },
  ])('$state (exit $exitCode, $health) failed: $failed', ({ oneShot, failed, ...fields }) => {
    expect(hasFailed(container(fields), oneShot)).toBe(failed);
  });

  it('prints a table of service, state and URL', () => {
    const table = formatTable([
      container({ service: 'web', health: 'healthy', urls: ['http://localhost:5173'] }),
      container({ service: 'migrate', state: 'exited' }),
    ]);

    expect(table.split('\n')).toEqual([
      'SERVICE  STATE              URL',
      'migrate  exited (0)',
      'web      running (healthy)  http://localhost:5173',
    ]);
  });
});
