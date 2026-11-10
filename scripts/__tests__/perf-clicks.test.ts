import { parseClickRun } from '../perf-clicks';

describe('parseClickRun', () => {
  it.each([
    { args: [], label: 'run', against: undefined, port: '5740' },
    { args: ['after'], label: 'after', against: undefined, port: '5740' },
    {
      args: ['after', '--against', 'before', '--port-base', '6100'],
      label: 'after',
      against: 'before',
      port: '6100',
    },
  ])('reads $args', ({ args, label, against, port }) => {
    const run = parseClickRun(args);

    expect(run.label).toBe(label);
    expect(run.against).toBe(against);
    expect(run.env).toMatchObject({ PERF_LABEL: label, E2E_PORT_BASE: port });
  });
});
