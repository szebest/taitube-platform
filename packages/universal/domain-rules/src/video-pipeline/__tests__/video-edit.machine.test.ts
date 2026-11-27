import { machineFindings } from '@kit/machine';
import { VIDEO_EDIT } from '../video-edit.machine';

describe('@vp/domain-rules: VIDEO_EDIT', () => {
  it('has no structural finding', () => {
    expect(machineFindings(VIDEO_EDIT)).toEqual([]);
  });

  it.each([
    { from: 'rendering', event: 'apply', to: 'applied' },
    { from: 'rendering', event: 'fail', to: 'failed' },
    { from: 'applied', event: 'revert', to: 'reverted' },
    { from: 'failed', event: 'revert', to: 'reverted' },
    { from: 'rendering', event: 'revert', to: undefined },
    { from: 'applied', event: 'render', to: 'rendering' },
    { from: 'failed', event: 'render', to: 'rendering' },
    { from: 'reverted', event: 'render', to: 'rendering' },
    { from: 'rendering', event: 'render', to: undefined },
    { from: 'reverted', event: 'revert', to: undefined },
  ] as const)('$event from $from: $to', ({ from, event, to }) => {
    expect(VIDEO_EDIT.next(from, event)).toBe(to);
  });
});
