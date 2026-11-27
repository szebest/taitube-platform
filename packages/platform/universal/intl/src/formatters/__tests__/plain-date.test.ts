import { contextFor, format } from '../../__tests__/fixtures';

describe('@kit/intl: plainDate', () => {
  it.each(['UTC', 'America/New_York', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'])(
    'reads a calendar date as that day in %s',
    (timeZone) => {
      const rendered = format(
        { type: 'plainDate', value: '2024-05-01' },
        contextFor('en-US', { timeZone })
      );

      expect(rendered).toEqual({ ok: true, value: 'May 1, 2024' });
    }
  );

  it.each([
    { value: '2024-02-30', code: 'FORMAT_UNRENDERABLE' },
    { value: '2024-05-01T12:00:00Z', code: 'FORMAT_UNRENDERABLE' },
  ])('declines $value', ({ value, code }) => {
    expect(format({ type: 'plainDate', value }, contextFor('en'))).toMatchObject({
      ok: false,
      error: { code, formatter: 'plainDate' },
    });
  });
});
