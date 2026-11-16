import { machineFindings } from '@vp/machine';
import { DATA_EXPORT } from '../data-export.machine';

describe('@vp/domain-rules: DATA_EXPORT', () => {
  it('has no structural finding', () => {
    expect(machineFindings(DATA_EXPORT)).toEqual([]);
  });

  it.each([
    { from: 'queued', event: 'start', to: 'running' },
    { from: 'running', event: 'start', to: 'running' },
    { from: 'running', event: 'finish', to: 'ready' },
    { from: 'queued', event: 'fail', to: 'failed' },
    { from: 'ready', event: 'expire', to: 'expired' },
    { from: 'queued', event: 'finish', to: undefined },
    { from: 'ready', event: 'fail', to: undefined },
    { from: 'ready', event: 'start', to: undefined },
    { from: 'failed', event: 'start', to: undefined },
    { from: 'expired', event: 'expire', to: undefined },
  ] as const)('$event from $from: $to', ({ from, event, to }) => {
    expect(DATA_EXPORT.next(from, event)).toBe(to);
  });
});
