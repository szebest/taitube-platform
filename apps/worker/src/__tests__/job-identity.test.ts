import { err, ok } from '@vp/result';
import { validateJobId, validateQueueName } from '../job-identity';

describe('apps/worker: job identity', () => {
  it.each([
    { name: 'invalid-queue', message: 'Unknown queue name "invalid-queue"' },
    { name: 'probe:invalid', message: "Queue name must not contain ':'" },
  ])('refuses the queue name $name', ({ name, message }) => {
    expect(() => validateQueueName(name)).toThrow(message);
  });

  it('accepts a declared queue name', () => {
    expect(validateQueueName('transcode-720p')).toBe('transcode-720p');
  });

  it('refuses a job id carrying the separator BullMQ rejects', () => {
    expect(validateJobId('video1:probe:g1')).toEqual(
      err(expect.objectContaining({ code: 'VALIDATION_FAILED', field: 'jobId' }))
    );
  });

  it('accepts a job id joined by --', () => {
    expect(validateJobId('video1--probe--g1')).toEqual(ok('video1--probe--g1'));
  });
});
