import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { aChannel } from '../../__tests__/entities';
import { decideHandleClaim } from '../claim-handle.rule';

describe('@vp/domain-rules: decideHandleClaim', () => {
  it('returns the normalised handle when nobody holds it', () => {
    const result = decideHandleClaim({ handle: 'Mateusz', heldBy: null });

    expect(isOk(result) && result.value).toBe('mateusz');
  });

  it('rejects a handle another channel already holds', () => {
    const result = decideHandleClaim({
      handle: 'mateusz',
      heldBy: aChannel({ id: 'channel-2' }),
      claimantChannelId: 'channel-1',
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.HANDLE_ALREADY_TAKEN);
  });

  it('lets a channel re-claim the handle it already holds', () => {
    const result = decideHandleClaim({
      handle: 'mateusz',
      heldBy: aChannel({ id: 'channel-1' }),
      claimantChannelId: 'channel-1',
    });

    expect(isOk(result)).toBe(true);
  });

  it('rejects a malformed handle before asking who holds it', () => {
    const result = decideHandleClaim({ handle: 'ab', heldBy: null });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.INVALID_HANDLE_FORMAT);
  });

  it('reports a reserved handle as taken, not as malformed', () => {
    const result = decideHandleClaim({ handle: 'admin', heldBy: null });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.HANDLE_ALREADY_TAKEN);
  });
});
