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

describe('@vp/domain-rules: decideHandleClaim with the handle history', () => {
  const retiredAt = new Date('2026-01-01T00:00:00.000Z');
  const day = 24 * 60 * 60 * 1000;
  const retired = { handle: 'old', channelId: 'channel-1', retiredAt };

  it.each([
    {
      scenario: 'inside the 90 days',
      daysLater: 89,
      claimant: 'channel-2',
      code: ErrorCodes.HANDLE_RESERVED,
    },
    {
      scenario: 'on the last day',
      daysLater: 90 - 1 / 24,
      claimant: 'channel-2',
      code: ErrorCodes.HANDLE_RESERVED,
    },
    { scenario: 'once the 90 days have passed', daysLater: 90, claimant: 'channel-2', code: null },
    { scenario: 'by the channel that retired it', daysLater: 1, claimant: 'channel-1', code: null },
  ])('answers a claim $scenario with $code', ({ daysLater, claimant, code }) => {
    const result = decideHandleClaim({
      handle: 'old',
      heldBy: null,
      claimantChannelId: claimant,
      retirement: { retired, now: new Date(retiredAt.getTime() + daysLater * day) },
    });

    expect(isErr(result) ? result.error.code : null).toBe(code);
  });

  it('tells the claimant when the handle is released', () => {
    const result = decideHandleClaim({
      handle: 'old',
      heldBy: null,
      claimantChannelId: 'channel-2',
      retirement: { retired, now: new Date(retiredAt.getTime() + day) },
    });

    expect(isErr(result) && result.error).toMatchObject({
      handle: 'old',
      availableAt: '2026-04-01T00:00:00.000Z',
    });
  });

  it('finds a free handle when nothing was retired', () => {
    expect(
      isOk(
        decideHandleClaim({
          handle: 'old',
          heldBy: null,
          retirement: { retired: null, now: retiredAt },
        })
      )
    ).toBe(true);
  });
});
