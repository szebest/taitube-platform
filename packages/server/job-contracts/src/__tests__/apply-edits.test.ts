import { APPLY_EDITS, ApplyEditsJob, applyEditsOutbox } from '../apply-edits';
import { defaultJobOptions, stagePolicies } from '../policies';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000a1';

describe('job-contracts: apply-edits', () => {
  it.each([
    {
      scenario: 'a video and a generation',
      payload: { videoId: VIDEO_ID, generation: 2, traceparent: 't' },
      ok: true,
    },
    {
      scenario: 'the first generation',
      payload: { videoId: VIDEO_ID, generation: 1, traceparent: 't' },
      ok: false,
    },
    { scenario: 'no trace', payload: { videoId: VIDEO_ID, generation: 2 }, ok: false },
    {
      scenario: 'an id that is no uuid',
      payload: { videoId: 'v1', generation: 2, traceparent: 't' },
      ok: false,
    },
  ])('reads a job with $scenario: $ok', ({ payload, ok }) => {
    expect(ApplyEditsJob.safeParse(payload).success).toBe(ok);
  });

  it('queues one render per generation on the 1080p transcode queue', () => {
    const job = { videoId: VIDEO_ID, generation: 3, traceparent: 't' };

    expect(applyEditsOutbox(job).payload).toEqual({
      type: 'queue',
      queueName: 'transcode-1080p',
      job: {
        name: APPLY_EDITS,
        data: job,
        opts: {
          jobId: `${VIDEO_ID}--apply-edits--g3`,
          ...stagePolicies['transcode-1080p'],
          ...defaultJobOptions,
        },
      },
    });
  });
});
