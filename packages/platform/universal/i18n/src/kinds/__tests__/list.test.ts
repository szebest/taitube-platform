import { ok } from '@kit/result';
import { listKind } from '../list';
import { contextFor } from './context';

describe('@kit/i18n: listKind', () => {
  it.each([
    { options: undefined, expected: ok('a, b, and c') },
    { options: { type: 'disjunction' } as const, expected: ok('a, b, or c') },
  ])('renders a list of strings with $options', ({ options, expected }) => {
    expect(listKind.format('{names:list}', ['a', 'b', 'c'], options, contextFor('en'))).toEqual(
      expected
    );
  });

  it.each([{ value: [1] }, { value: 'a' }])('declines $value', ({ value }) => {
    expect(listKind.format('{names:list}', value, undefined, contextFor('en'))).toEqual(
      expect.objectContaining({ ok: false })
    );
  });
});
