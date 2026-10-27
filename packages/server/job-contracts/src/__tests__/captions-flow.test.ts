import { captionsFlow } from '../captions-flow';
import { ids } from '../index';

const VIDEO = '11111111-1111-7111-8111-111111111111';
const run = (durationMs: number) => ({
  videoId: VIDEO,
  captionId: '22222222-2222-7222-8222-222222222222',
  captionVersion: 3,
  sourceKey: `raw/${VIDEO}/source.mp4`,
  durationMs,
  modelVersion: 'small-q5_1',
  language: null,
  traceparent: '',
});

describe('@vp/job-contracts: captions flow', () => {
  it('runs a short source as one job on the captions queue', () => {
    const flow = captionsFlow(run(300_000));

    expect(flow).toMatchObject({
      queueName: 'captions',
      data: { plan: { type: 'single' } },
      opts: { jobId: ids.captions(VIDEO, 'small-q5_1', 3), attempts: 3 },
    });
    expect(flow.children).toBeUndefined();
  });

  it('runs a long source as a merge over one window job each, all on the captions queue', () => {
    const flow = captionsFlow(run(720_000));

    expect(flow.data.plan).toEqual({ type: 'merge', windowCount: 4 });
    expect(
      flow.children?.map((child) => [child.queueName, child.opts.jobId, child.data.plan])
    ).toEqual(
      [0, 1, 2, 3].map((index) => [
        'captions',
        ids.captionsChunk(VIDEO, 'small-q5_1', 3, index),
        { type: 'window', index, windowCount: 4 },
      ])
    );
    expect(flow.children?.every((child) => child.opts.failParentOnFailure)).toBe(true);
  });
});
