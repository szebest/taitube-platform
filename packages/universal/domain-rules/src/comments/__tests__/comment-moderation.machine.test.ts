import { machineFindings } from '@vp/machine';
import { COMMENT_MODERATION } from '../comment-moderation.machine';

describe('@vp/domain-rules: COMMENT_MODERATION', () => {
  it('has no structural finding', () => {
    expect(machineFindings(COMMENT_MODERATION)).toEqual([]);
  });
});
