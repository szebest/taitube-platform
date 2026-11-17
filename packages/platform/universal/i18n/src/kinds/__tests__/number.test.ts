import { ok } from '@kit/result';
import { numberKind } from '../number';
import { contextFor } from './context';

describe('@kit/i18n: numberKind', () => {
  it.each([
    { options: undefined, expected: ok('1,234.5') },
    { options: { maximumFractionDigits: 0 }, expected: ok('1,235') },
  ])('renders through @vp/intl with $options', ({ options, expected }) => {
    expect(numberKind.format('{n:number}', 1234.5, options, contextFor('en'))).toEqual(expected);
  });

  it('declines anything but a number', () => {
    expect(numberKind.format('{n:number}', '1', undefined, contextFor('en'))).toEqual(
      expect.objectContaining({ ok: false })
    );
  });
});
