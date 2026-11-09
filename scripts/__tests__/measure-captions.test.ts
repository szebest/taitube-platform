import {
  isolationVerdict,
  parseSpan,
  promQueries,
  queryScalar,
  readyVerdict,
  realtimeFactor,
} from '../measure-captions';

function prometheus(value: string | undefined): typeof fetch {
  return async () =>
    Response.json({
      status: 'success',
      data: { resultType: 'vector', result: value === undefined ? [] : [{ value: [1, value] }] },
    });
}

describe('realtimeFactor', () => {
  it('is seconds of audio per second of wall clock, the way captions_realtime_factor observes it', () => {
    expect(realtimeFactor(600_000, 300_000)).toBe(2);
  });
});

describe('readyVerdict', () => {
  it.each([
    { pods: 3 as const, seconds: 360, passes: true },
    { pods: 3 as const, seconds: 361, passes: false },
    { pods: 1 as const, seconds: 720, passes: true },
    { pods: 1 as const, seconds: 721, passes: false },
  ])('$seconds s with $pods pods passes: $passes', ({ pods, seconds, passes }) => {
    expect(readyVerdict(seconds, pods).passes).toBe(passes);
  });
});

describe('isolationVerdict', () => {
  it.each([
    { running: 21, paused: 20, passes: true },
    { running: 21.1, paused: 20, passes: false },
    { running: 19, paused: 20, passes: true },
  ])(
    'p95 $running s running against $paused s paused passes: $passes',
    ({ running, paused, passes }) => {
      expect(isolationVerdict(running, paused).passes).toBe(passes);
    }
  );

  it('reports the ratio', () => {
    expect(isolationVerdict(21, 20).ratio).toBeCloseTo(1.05);
  });
});

describe('promQueries', () => {
  it('reads the same series the pipeline dashboard does, over the given window', () => {
    const queries = promQueries('30m');

    expect(queries.realtimeFactor).toBe(
      'histogram_quantile(0.5, sum(rate(captions_realtime_factor_bucket[30m])) by (le))'
    );
    expect(queries.timeToReady).toBe(
      'sum(increase(captions_time_to_ready_seconds_sum[30m])) / sum(increase(captions_time_to_ready_seconds_count[30m]))'
    );
    expect(queries.readyCount).toBe('sum(increase(captions_time_to_ready_seconds_count[30m]))');
    expect(queries.transcodeP95).toBe(
      'histogram_quantile(0.95, sum(rate(job_duration_seconds_bucket{queue="transcode-720p"}[30m])) by (le))'
    );
  });
});

describe('parseSpan', () => {
  it('reads the span as a window ending at its end time', () => {
    expect(parseSpan('2026-01-01T10:00:00Z,2026-01-01T10:30:00Z')).toEqual({
      window: '1800s',
      end: Date.parse('2026-01-01T10:30:00Z') / 1000,
    });
  });

  it.each(['', 'nope', '2026-01-01T10:30:00Z,2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z'])(
    'rejects %j',
    (span) => {
      expect(() => parseSpan(span)).toThrow('as ISO times');
    }
  );
});

describe('queryScalar', () => {
  it('returns the single value Prometheus answers with', async () => {
    expect(await queryScalar('http://prom', 'up', 1000, prometheus('12.5'))).toBe(12.5);
  });

  it('asks for the query at the given instant', async () => {
    const urls: string[] = [];
    const recording: typeof fetch = async (input) => {
      urls.push(String(input));
      return prometheus('1')(input);
    };

    await queryScalar('http://prom', 'sum(x)', 1000, recording);

    expect(urls).toEqual(['http://prom/api/v1/query?query=sum(x)&time=1000']);
  });

  it.each([undefined, 'NaN'])(
    'fails when the query matched nothing (%s), rather than reporting a number',
    async (value) => {
      await expect(queryScalar('http://prom', 'up', 1000, prometheus(value))).rejects.toThrow(
        'matched no series'
      );
    }
  );
});
