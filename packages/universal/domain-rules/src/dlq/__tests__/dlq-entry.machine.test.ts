import { machineFindings } from '@vp/machine';
import { DLQ_ENTRY } from '../dlq-entry.machine';

describe('@vp/domain-rules: DLQ_ENTRY', () => {
  it('has no structural finding', () => {
    expect(machineFindings(DLQ_ENTRY)).toEqual([]);
  });

  it.each(['REPLAYED', 'DISCARDED'] as const)('leaves an entry %s for good', (state) => {
    expect(DLQ_ENTRY.eventNames.map((event) => DLQ_ENTRY.next(state, event))).toEqual([
      undefined,
      undefined,
    ]);
  });
});
