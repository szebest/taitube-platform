import { expectErr, expectOk } from '@vp/testing/result';
import { decideHandleChange } from '../handle-change.rule';

const DAY = 24 * 60 * 60 * 1000;
const changedAt = new Date('2026-03-01T00:00:00.000Z');
const after = (days: number) => new Date(changedAt.getTime() + days * DAY);

describe('@vp/domain-rules: decideHandleChange', () => {
  it.each([
    { scenario: 'never changed it', handleChangedAt: null, now: changedAt, expected: true },
    {
      scenario: 'changed it 30 days ago',
      handleChangedAt: changedAt,
      now: after(30),
      expected: true,
    },
    {
      scenario: 'changed it 31 days ago',
      handleChangedAt: changedAt,
      now: after(31),
      expected: true,
    },
  ])('lets a channel that $scenario change it', ({ handleChangedAt, now, expected }) => {
    expect(
      expectOk(
        decideHandleChange({ currentHandle: 'ada', nextHandle: 'grace', handleChangedAt, now })
      )
    ).toEqual({ changes: expected });
  });

  it.each([
    { scenario: 'a second after the change', now: new Date(changedAt.getTime() + 1000) },
    { scenario: '29 days after', now: after(29) },
    { scenario: 'the instant before the cooldown ends', now: new Date(after(30).getTime() - 1) },
  ])('refuses a change $scenario, saying when it is allowed', ({ now }) => {
    expect(
      expectErr(
        decideHandleChange({
          currentHandle: 'ada',
          nextHandle: 'grace',
          handleChangedAt: changedAt,
          now,
        })
      )
    ).toEqual({
      code: 'HANDLE_CHANGE_TOO_SOON',
      message: 'The handle was changed recently',
      availableAt: after(30).toISOString(),
    });
  });

  it.each(['ada', 'ADA', 'Ada'])(
    'treats saving %s again as no change, whatever the cooldown',
    (next) => {
      expect(
        expectOk(
          decideHandleChange({
            currentHandle: 'ada',
            nextHandle: next,
            handleChangedAt: changedAt,
            now: changedAt,
          })
        )
      ).toEqual({ changes: false });
    }
  );
});
