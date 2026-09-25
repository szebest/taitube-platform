import { ok } from '@vp/result';
import { findUnknownOption, withOptions } from '../with-options';
import { contextFor } from './fixtures';

interface Probe {
  readonly type: 'probe';
  readonly options?: { readonly style?: string };
}

const probe = withOptions<Probe>('probe', ['style'], () => ok('rendered'));

describe('@vp/intl: withOptions', () => {
  it.each([
    { scenario: 'no options', value: { type: 'probe' } as const },
    { scenario: 'a named option', value: { type: 'probe', options: { style: 'short' } } as const },
  ])('formats with $scenario', ({ value }) => {
    expect(probe(value, contextFor('en'))).toEqual({ ok: true, value: 'rendered' });
  });

  it('declines an option it does not name, carrying the offending key', () => {
    // @ts-expect-error the misspelling is refused at compile time as well
    const declined = probe({ type: 'probe', options: { stlye: 'short' } }, contextFor('en'));

    expect(declined).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'FORMAT_UNKNOWN_OPTION',
        formatter: 'probe',
        option: 'stlye',
      }),
    });
  });

  it.each([
    { options: undefined, expected: undefined },
    { options: { numeric: true }, expected: undefined },
    { options: { numeric: true, sensitivty: 'base' }, expected: 'sensitivty' },
  ])('finds $expected among $options', ({ options, expected }) => {
    expect(findUnknownOption(['numeric'], options)).toBe(expected);
  });
});
