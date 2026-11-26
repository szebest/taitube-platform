import { machineFindings } from '@kit/machine';
import { EXPERIMENT } from '../experiment.machine';

describe('@vp/domain-rules: EXPERIMENT', () => {
  it('has no structural finding', () => {
    expect(machineFindings(EXPERIMENT)).toEqual([]);
  });

  it.each([
    { from: 'running', event: 'apply', to: 'finished' },
    { from: 'running', event: 'stop', to: 'stopped' },
    { from: 'finished', event: 'apply', to: undefined },
    { from: 'finished', event: 'stop', to: undefined },
    { from: 'stopped', event: 'apply', to: undefined },
    { from: 'stopped', event: 'stop', to: undefined },
  ] as const)('$event from $from: $to', ({ from, event, to }) => {
    expect(EXPERIMENT.next(from, event)).toBe(to);
  });
});
