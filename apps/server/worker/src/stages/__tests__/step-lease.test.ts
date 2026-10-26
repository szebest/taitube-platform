import { databaseUnavailable } from '@vp/errors';
import { err, ok } from '@vp/result';
import { stepLease } from '../step-lease';

describe('apps/server/worker/stages: step lease', () => {
  it('renews at most once per interval unless forced', async () => {
    const heartbeat = vi.fn().mockResolvedValue(ok(true));
    const lease = stepLease({ heartbeat }, 'lock');

    lease.renew();
    lease.renew();
    lease.renew(true);
    await lease.settled();

    expect(heartbeat).toHaveBeenCalledTimes(2);
    expect(lease.lost).toBeUndefined();
    expect(lease.signal.aborted).toBe(false);
  });

  it.each([
    { reason: 'a step another worker holds', outcome: ok(false), lost: { type: 'fenced' } },
    {
      reason: 'a refused renewal',
      outcome: err(databaseUnavailable('heartbeat')),
      lost: {
        type: 'unavailable',
        failure: expect.objectContaining({ code: 'DATABASE_UNAVAILABLE' }),
      },
    },
  ])('aborts the encode on $reason', async ({ outcome, lost }) => {
    const lease = stepLease({ heartbeat: vi.fn().mockResolvedValue(outcome) }, 'lock');

    lease.renew();
    await lease.settled();

    expect(lease.lost).toEqual(lost);
    expect(lease.signal.aborted).toBe(true);
  });
});
