import { machineFindings } from '@vp/machine';
import { UPLOAD_SESSION } from '../upload-session.machine';

describe('@vp/domain-rules: UPLOAD_SESSION', () => {
  it('has no structural finding', () => {
    expect(machineFindings(UPLOAD_SESSION)).toEqual([]);
  });
});
