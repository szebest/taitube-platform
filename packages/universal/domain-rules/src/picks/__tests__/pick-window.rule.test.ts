import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { PICK_NOW } from '../../__tests__/entities';
import { validatePickWindow } from '../pick-window.rule';

const at = (iso: string) => new Date(iso);

describe('@vp/domain-rules: validatePickWindow', () => {
  it.each([
    {
      name: 'a window in the future',
      startsAt: '2026-03-02T00:00:00Z',
      endsAt: '2026-03-03T00:00:00Z',
    },
    {
      name: 'a window that has begun',
      startsAt: '2026-03-01T00:00:00Z',
      endsAt: '2026-03-02T00:00:00Z',
    },
    {
      name: 'a window ending one millisecond ahead',
      startsAt: '2026-03-01T00:00:00Z',
      endsAt: '2026-03-01T12:00:00.001Z',
    },
  ])('accepts $name', ({ startsAt, endsAt }) => {
    const window = { startsAt: at(startsAt), endsAt: at(endsAt) };

    expect(expectOk(validatePickWindow(window, PICK_NOW))).toBe(window);
  });

  it.each([
    {
      name: 'an end before the start',
      startsAt: '2026-03-03T00:00:00Z',
      endsAt: '2026-03-02T00:00:00Z',
    },
    { name: 'an empty window', startsAt: '2026-03-02T00:00:00Z', endsAt: '2026-03-02T00:00:00Z' },
    {
      name: 'a window that ends now',
      startsAt: '2026-03-01T00:00:00Z',
      endsAt: '2026-03-01T12:00:00Z',
    },
    {
      name: 'a window in the past',
      startsAt: '2026-02-01T00:00:00Z',
      endsAt: '2026-02-02T00:00:00Z',
    },
  ])('rejects $name and names endsAt', ({ startsAt, endsAt }) => {
    const failure = expectErr(
      validatePickWindow({ startsAt: at(startsAt), endsAt: at(endsAt) }, PICK_NOW)
    );

    expect(failure).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED, field: 'endsAt' });
  });
});
