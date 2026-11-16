import { ok } from '@vp/result';
import { NOW } from '../../__tests__/fixtures';
import { dateKind } from '../date';
import { contextFor } from './context';

describe('@kit/i18n: dateKind', () => {
  it.each([
    { options: undefined, expected: ok('Sep 22, 2026') },
    { options: { style: 'long' } as const, expected: ok('September 22, 2026') },
  ])('renders an ISO instant with $options', ({ options, expected }) => {
    expect(dateKind.format('{when:date}', NOW, options, contextFor('en'))).toEqual(expected);
  });

  it('declines a number', () => {
    expect(dateKind.format('{when:date}', 5, undefined, contextFor('en'))).toEqual(
      expect.objectContaining({ ok: false })
    );
  });
});
