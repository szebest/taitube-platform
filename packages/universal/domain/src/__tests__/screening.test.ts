import { SCREENING_TRANSITIONS } from '../screening';
import { VIDEO_STATUSES } from '../status-vocabulary';

describe('packages/domain: screening transitions', () => {
  it.each([
    { name: 'hold', from: 'PROCESSING', to: 'HELD' },
    { name: 'approve', from: 'HELD', to: 'PROCESSING' },
    { name: 'reject', from: 'HELD', to: 'REJECTED' },
    { name: 'appeal', from: 'REJECTED', to: 'HELD' },
  ] as const)('$name moves $from to $to', ({ name, from, to }) => {
    expect(SCREENING_TRANSITIONS[name]).toMatchObject({ from, to });
  });

  it('names every edge by an event of its own', () => {
    const events = Object.values(SCREENING_TRANSITIONS).map((edge) => edge.event);

    expect(new Set(events).size).toBe(events.length);
  });

  it.each(Object.entries(SCREENING_TRANSITIONS))(
    '%s starts and ends in a status the vocabulary declares',
    (_name, { from, to }) => {
      expect(VIDEO_STATUSES).toContain(from);
      expect(VIDEO_STATUSES).toContain(to);
    }
  );
});
