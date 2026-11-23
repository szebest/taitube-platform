import { machineFindings } from '@kit/machine';
import { VIDEO_GENERATION } from '../video-generation.machine';

describe('@vp/domain-rules: VIDEO_GENERATION', () => {
  it('has no structural finding', () => {
    expect(machineFindings(VIDEO_GENERATION)).toEqual([]);
  });

  it.each([
    { from: 'uploading', event: 'render', to: 'rendering' },
    { from: 'rendering', event: 'swap', to: 'active' },
    { from: 'uploading', event: 'fail', to: 'failed' },
    { from: 'rendering', event: 'fail', to: 'failed' },
    { from: 'active', event: 'retire', to: 'retired' },
    { from: 'retired', event: 'restore', to: 'active' },
    { from: 'retired', event: 'purge', to: 'purged' },
    { from: 'active', event: 'purge', to: undefined },
    { from: 'failed', event: 'swap', to: undefined },
    { from: 'purged', event: 'restore', to: undefined },
  ] as const)('$event from $from: $to', ({ from, event, to }) => {
    expect(VIDEO_GENERATION.next(from, event)).toBe(to);
  });
});
