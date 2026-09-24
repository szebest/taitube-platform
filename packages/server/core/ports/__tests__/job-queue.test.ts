import { QUEUE_JOB_STATES } from '../job-queue';

describe('core: job queue port', () => {
  it('counts a queue in prioritized, where BullMQ keeps every job that carries a priority', () => {
    expect(QUEUE_JOB_STATES).toContain('prioritized');
  });

  it('counts no paused state, which BullMQ 6 keeps no list for', () => {
    expect(QUEUE_JOB_STATES).not.toContain('paused');
  });
});
