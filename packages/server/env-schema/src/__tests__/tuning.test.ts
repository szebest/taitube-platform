import * as tuning from '../tuning';

function numbers(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  return typeof value === 'object' && value !== null ? Object.values(value).flatMap(numbers) : [];
}

describe('packages/env-schema: tuning', () => {
  it.each(Object.entries(tuning))('holds %s at positive, finite values', (_name, value) => {
    const values = numbers(value);

    expect(values.length).toBeGreaterThan(0);
    expect(values.filter((n) => !(Number.isFinite(n) && n > 0))).toEqual([]);
  });

  it('keeps the JWKS fetch timeout under the refetch interval, so a hung fetch cannot stack', () => {
    expect(tuning.JWKS_FETCH_TIMEOUT_MS).toBeLessThan(tuning.JWKS_REFETCH_INTERVAL_MS);
  });
});
