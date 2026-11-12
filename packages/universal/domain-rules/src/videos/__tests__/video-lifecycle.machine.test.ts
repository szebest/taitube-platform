import { SCREENING_TRANSITIONS } from '@vp/domain';
import { machineFindings } from '@vp/machine';
import { VIDEO_LIFECYCLE } from '../video-lifecycle.machine';

describe('@vp/domain-rules: VIDEO_LIFECYCLE', () => {
  it('has no structural finding', () => {
    expect(machineFindings(VIDEO_LIFECYCLE)).toEqual([]);
  });

  it.each([
    { edge: 'hold', name: 'hold' },
    { edge: 'approve', name: 'approve' },
    { edge: 'rejectScreening', name: 'reject' },
    { edge: 'appeal', name: 'appeal' },
  ] as const)('takes the $name screening edge from SCREENING_TRANSITIONS', ({ edge, name }) => {
    const { from, to, event } = SCREENING_TRANSITIONS[name];

    expect(VIDEO_LIFECYCLE.events[edge]).toEqual({ from: [from], to, event });
  });
});
