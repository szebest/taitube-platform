import { NotifyPartyReminderJob, partyReminderOutboxes } from '../party-reminders';

const ROOM_ID = '018f0000-0000-7000-8000-000000000001';

describe('job-contracts: party reminders', () => {
  it('reads a well-formed payload', () => {
    const valid = { roomId: ROOM_ID, scheduledFor: '2026-12-01T20:00:00.000Z', lead: 'before' };

    expect(NotifyPartyReminderJob.parse(valid)).toEqual(valid);
    expect(NotifyPartyReminderJob.safeParse({}).success).toBe(false);
  });

  const START = new Date('2026-12-01T20:00:00.000Z');
  const delaysAt = (now: string) =>
    partyReminderOutboxes(ROOM_ID, START, new Date(now)).map(({ payload }) =>
      payload.type === 'queue' ? [payload.job.opts?.jobId, payload.job.opts?.delay] : undefined
    );

  it.each([
    {
      scenario: 'more than ten minutes ahead: both reminders',
      now: '2026-12-01T19:00:00.000Z',
      expected: [
        [`${ROOM_ID}--notify-party-reminder--${START.getTime()}--before`, 50 * 60_000],
        [`${ROOM_ID}--notify-party-reminder--${START.getTime()}--start`, 60 * 60_000],
      ],
    },
    {
      scenario: 'inside the last ten minutes: only the start',
      now: '2026-12-01T19:55:00.000Z',
      expected: [[`${ROOM_ID}--notify-party-reminder--${START.getTime()}--start`, 5 * 60_000]],
    },
    { scenario: 'past the start: none', now: '2026-12-01T20:00:00.000Z', expected: [] },
  ])('enqueues $scenario', ({ now, expected }) => {
    expect(delaysAt(now)).toEqual(expected);
  });
});
