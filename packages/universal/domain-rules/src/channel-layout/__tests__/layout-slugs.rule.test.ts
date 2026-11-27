import { expectErr, expectOk } from '@kit/testing/result';
import { decideLayoutSlugs } from '../layout-slugs.rule';
import { customTab, layoutWith } from './layout-fixtures';

describe('@vp/domain-rules: decideLayoutSlugs', () => {
  it('lets a fresh well-formed slug through', () => {
    expectOk(decideLayoutSlugs(layoutWith(customTab('a', 'episodes-2')), null));
  });

  it.each([
    { scenario: 'too short', slug: 'ab', reason: 'format' },
    { scenario: 'in capitals', slug: 'Episodes', reason: 'format' },
    { scenario: 'over 30 characters', slug: 'a'.repeat(31), reason: 'format' },
    { scenario: 'a built-in tab', slug: 'videos', reason: 'reserved' },
    { scenario: 'a reserved word', slug: 'community', reason: 'reserved' },
  ])('refuses a slug that is $scenario', ({ slug, reason }) => {
    expect(expectErr(decideLayoutSlugs(layoutWith(customTab('a', slug)), null))).toMatchObject({
      code: 'LAYOUT_SLUG_INVALID',
      reason,
    });
  });

  it('refuses a slug two tabs share', () => {
    const layout = layoutWith(customTab('a', 'episodes'), customTab('b', 'episodes'));

    expect(expectErr(decideLayoutSlugs(layout, null))).toMatchObject({ reason: 'taken' });
  });

  it('refuses a new slug on a tab that was published, and allows its own again', () => {
    const published = layoutWith(customTab('a', 'episodes'));

    expect(
      expectErr(decideLayoutSlugs(layoutWith(customTab('a', 'shows')), published))
    ).toMatchObject({ reason: 'changed' });
    expectOk(decideLayoutSlugs(layoutWith(customTab('a', 'episodes')), published));
  });
});
