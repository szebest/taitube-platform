import { ErrorCodes, isInputFailure } from '@vp/errors';
import { dlqEntryNotFound, replayQueueUnknown } from '../failures';

describe('@vp/domain-rules: dlq failures', () => {
  it.each([
    {
      name: 'dlqEntryNotFound',
      failure: dlqEntryNotFound('dlq-1'),
      code: ErrorCodes.DLQ_ENTRY_NOT_FOUND,
    },
    { name: 'replayQueueUnknown', failure: replayQueueUnknown('probe'), code: ErrorCodes.INTERNAL },
  ])('$name carries $code and stays off the wire', ({ failure, code }) => {
    expect(failure.code).toBe(code);
    expect(isInputFailure(failure)).toBe(false);
  });

  it('names the entry and the queue it could not reach', () => {
    expect(dlqEntryNotFound('dlq-1').message).toContain('dlq-1');
    expect(replayQueueUnknown('probe').message).toContain('probe');
  });
});
