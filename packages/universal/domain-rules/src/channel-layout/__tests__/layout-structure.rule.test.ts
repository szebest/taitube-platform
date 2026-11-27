import { expectErr, expectOk } from '@kit/testing/result';
import { type ChannelLayout, standardChannelLayout } from '@vp/domain';
import { decideLayoutStructure } from '../layout-structure.rule';
import { contentSection, customTab, layoutWith, layoutWithHomeSections } from './layout-fixtures';

const without = (kind: string): ChannelLayout => {
  const base = standardChannelLayout();
  return { ...base, tabs: base.tabs.filter((tab) => tab.kind !== kind) };
};

const withSecondPostsTab = (): ChannelLayout => {
  const base = standardChannelLayout();
  const posts = base.tabs.find((tab) => tab.kind === 'posts');
  return { ...base, tabs: [...base.tabs, ...(posts ? [{ ...posts, id: 'posts-2' }] : [])] };
};

const hiding = (kind: string): ChannelLayout => {
  const base = standardChannelLayout();
  return {
    ...base,
    tabs: base.tabs.map((tab) => (tab.kind === kind ? { ...tab, hidden: true } : tab)),
  };
};

describe('@vp/domain-rules: decideLayoutStructure', () => {
  it.each([
    { scenario: 'the default layout', layout: standardChannelLayout() },
    { scenario: 'a hidden Shorts tab', layout: hiding('shorts') },
    {
      scenario: 'a custom tab a section links to',
      layout: layoutWith({
        ...customTab('c', 'episodes'),
        sections: [contentSection('s', { seeAll: 'videos' })],
      }),
    },
  ])('lets $scenario through', ({ layout }) => {
    expectOk(decideLayoutStructure(layout));
  });

  it.each([
    {
      scenario: 'a tab id twice',
      layout: layoutWith(customTab('home', 'episodes')),
      reason: 'duplicate_tab',
    },
    {
      scenario: 'a section id twice',
      layout: layoutWithHomeSections(contentSection('s'), contentSection('s')),
      reason: 'duplicate_section',
    },
    { scenario: 'no About tab', layout: without('about'), reason: 'built_in_missing' },
    {
      scenario: 'a second Posts tab',
      layout: withSecondPostsTab(),
      reason: 'built_in_repeated',
    },
    { scenario: 'a hidden Home', layout: hiding('home'), reason: 'pinned_tab_hidden' },
    { scenario: 'a hidden About', layout: hiding('about'), reason: 'pinned_tab_hidden' },
    {
      scenario: 'a landing tab that is gone',
      layout: { ...standardChannelLayout(), landing: { visitor: 'home', subscriber: 'gone' } },
      reason: 'landing_unknown',
    },
    {
      scenario: 'a see all that points nowhere',
      layout: layoutWithHomeSections(contentSection('s', { seeAll: 'gone' })),
      reason: 'see_all_unknown',
    },
    {
      scenario: 'a link that is not https',
      layout: layoutWithHomeSections({
        kind: 'links',
        id: 'l',
        links: [{ label: 'Site', url: 'http://example.com' }],
        presentation: contentSection('x').presentation,
        visibility: contentSection('x').visibility,
      }),
      reason: 'links_invalid',
    },
  ])('refuses $scenario', ({ layout, reason }) => {
    expect(expectErr(decideLayoutStructure(layout))).toMatchObject({
      code: 'LAYOUT_STRUCTURE_INVALID',
      reason,
    });
  });
});
