import { machineFindings } from '@vp/machine';
import { OUTBOX_ROW } from '../outbox-row.machine';

describe('@vp/domain-rules: OUTBOX_ROW', () => {
  it('has no structural finding', () => {
    expect(machineFindings(OUTBOX_ROW)).toEqual([]);
  });
});
