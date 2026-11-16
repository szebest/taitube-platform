import { MS_PER_HOUR, MS_PER_SECOND } from '@vp/domain/time';
import { OUTBOX_MAX_ATTEMPTS, decideOutboxAttempt } from '../outbox-attempt.rule';

const NOW = new Date('2026-01-01T00:00:00.000Z');

describe('@vp/domain-rules: decideOutboxAttempt', () => {
  it.each([
    { attempts: 1, status: 'PENDING', delayMs: 2 * MS_PER_SECOND },
    { attempts: 3, status: 'PENDING', delayMs: 8 * MS_PER_SECOND },
    { attempts: 12, status: 'PENDING', delayMs: MS_PER_HOUR },
    { attempts: OUTBOX_MAX_ATTEMPTS - 1, status: 'PENDING', delayMs: MS_PER_HOUR },
    { attempts: OUTBOX_MAX_ATTEMPTS, status: 'DEAD', delayMs: MS_PER_HOUR },
  ])('leaves a row $status after attempt $attempts, claimable $delayMs ms on', (row) => {
    expect(decideOutboxAttempt(row.attempts, NOW)).toEqual({
      status: row.status,
      claimableAt: new Date(NOW.getTime() + row.delayMs),
    });
  });
});
