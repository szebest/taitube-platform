import { machineFindings } from '@kit/machine';
import { POST_LIFECYCLE } from '../post-lifecycle.machine';

describe('@vp/domain-rules: POST_LIFECYCLE', () => {
  it('has no structural finding', () => {
    expect(machineFindings(POST_LIFECYCLE)).toEqual([]);
  });

  it.each([
    { from: 'draft', event: 'schedule', to: 'scheduled' },
    { from: 'draft', event: 'publish', to: 'published' },
    { from: 'scheduled', event: 'publish', to: 'published' },
  ] as const)('moves $from to $to on $event', ({ from, event, to }) => {
    expect(POST_LIFECYCLE.next(from, event)).toBe(to);
  });

  it.each([
    { from: 'scheduled', event: 'schedule' },
    { from: 'published', event: 'schedule' },
    { from: 'published', event: 'publish' },
  ] as const)('refuses $event from $from', ({ from, event }) => {
    expect(POST_LIFECYCLE.next(from, event)).toBeUndefined();
  });
});
