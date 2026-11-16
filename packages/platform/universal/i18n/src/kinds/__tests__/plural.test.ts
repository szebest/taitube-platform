import { ok } from '@vp/result';
import { pluralKind } from '../plural';
import { contextFor } from './context';

const VIEWS = { one: '{?} view', other: '{?} views', formatter: 'compact' };

describe('@kit/i18n: pluralKind', () => {
  it.each([
    { count: 1, expected: ok('number(1, "compact") view') },
    { count: 2, expected: ok('number(2, "compact") views') },
  ])(
    'selects the $count branch and renders the count as a number with its formatter',
    ({ count, expected }) => {
      expect(pluralKind.format('{count:plural}', count, VIEWS, contextFor('en'))).toEqual(expected);
    }
  );

  it('takes the ordinal rules when the branches ask', () => {
    const places = { one: '{?}st', two: '{?}nd', few: '{?}rd', other: '{?}th', type: 'ordinal' };

    expect(pluralKind.format('{count:plural}', 2, places, contextFor('en'))).toEqual(
      ok('number(2, undefined)nd')
    );
  });

  it.each([
    { scenario: 'no branches', entry: undefined },
    { scenario: 'branches without other', entry: { one: '{?}' } },
  ])('fails on $scenario', ({ entry }) => {
    expect(pluralKind.format('{count:plural}', 1, entry, contextFor('en'))).toEqual(
      expect.objectContaining({ ok: false })
    );
  });
});
