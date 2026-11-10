import { parseClickRun } from '../perf-clicks';

describe('parseClickRun', () => {
  it.each([
    { args: [], label: 'run', against: undefined, port: '5740', throttle: '1' },
    { args: ['after'], label: 'after', against: undefined, port: '5740', throttle: '1' },
    {
      args: ['slow', '--throttle', '4'],
      label: 'slow',
      against: undefined,
      port: '5740',
      throttle: '4',
    },
    {
      args: ['after', '--against', 'before', '--port-base', '6100'],
      label: 'after',
      against: 'before',
      port: '6100',
      throttle: '1',
    },
  ])('reads $args', ({ args, label, against, port, throttle }) => {
    const run = parseClickRun(args);

    expect(run.label).toBe(label);
    expect(run.against).toBe(against);
    expect(run.env).toMatchObject({
      PERF_LABEL: label,
      E2E_PORT_BASE: port,
      PERF_CPU_THROTTLE: throttle,
    });
  });
});
