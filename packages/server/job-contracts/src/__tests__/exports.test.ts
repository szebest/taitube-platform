import { EXPORT_DATA, ExportJob, exportOutbox } from '../exports';
import { defaultJobOptions, stagePolicies } from '../policies';

const EXPORT_ID = '00000000-0000-7000-8000-0000000000f1';

describe('job-contracts: exports', () => {
  it.each([
    { scenario: 'an export id', payload: { exportId: EXPORT_ID }, ok: true },
    { scenario: 'a trace', payload: { exportId: EXPORT_ID, traceparent: '00-a-b-01' }, ok: true },
    { scenario: 'no export id', payload: {}, ok: false },
    { scenario: 'an id that is no uuid', payload: { exportId: 'e1' }, ok: false },
  ])('reads a job with $scenario: $ok', ({ payload, ok }) => {
    expect(ExportJob.safeParse(payload).success).toBe(ok);
  });

  it('queues one export job per export on the notify queue', () => {
    expect(exportOutbox({ exportId: EXPORT_ID }).payload).toEqual({
      type: 'queue',
      queueName: 'notify',
      job: {
        name: EXPORT_DATA,
        data: { exportId: EXPORT_ID },
        opts: { jobId: `${EXPORT_ID}--export`, ...stagePolicies.notify, ...defaultJobOptions },
      },
    });
  });
});
