import {
  type ChannelLayout,
  channelLayoutTemplate,
  LAYOUT_LIMITS,
  standardChannelLayout,
  tabSections,
} from '@vp/domain';
import {
  addCustomTab,
  addSection,
  canAddSection,
  canAddTab,
  duplicateSection,
  duplicateTab,
  findSectionTab,
  isSectionHidden,
  removeSection,
  removeTab,
  reorderSections,
  reorderTabs,
  renameTab,
  replaceSection,
  SECTION_BLOCKS,
  sectionsOf,
  setLanding,
  setSectionHidden,
  setTabHidden,
  updateCustomTab,
} from '../layout-edits';

const series = () => channelLayoutTemplate('series_focused');
const idsOf = (layout: ChannelLayout) => layout.tabs.map(({ id }) => id);
const homeIds = (layout: ChannelLayout) =>
  sectionsOf({ ...layout, tabs: layout.tabs.slice(0, 1) }).map(({ id }) => id);

const withCustomTabs = (count: number): ChannelLayout =>
  Array.from({ length: count }).reduce<ChannelLayout>(
    (layout) => addCustomTab(layout, 'Tab'),
    standardChannelLayout()
  );

describe('apps/client/studio: layout edits', () => {
  it('reorders tabs and sections to the order given', () => {
    const layout = series();

    expect(
      idsOf(reorderTabs(layout, ['about', ...idsOf(layout).filter((id) => id !== 'about')]))[0]
    ).toBe('about');
    expect(
      homeIds(reorderSections(layout, 'home', ['start-here', 'series', 'newest-episode']))
    ).toEqual(['start-here', 'series', 'newest-episode']);
  });

  it.each([
    { scenario: 'a built-in tab', tabId: 'videos', hidden: true },
    { scenario: 'a custom tab', tabId: 'episodes', hidden: true },
    { scenario: 'Home', tabId: 'home', hidden: false },
    { scenario: 'About', tabId: 'about', hidden: false },
  ])('hides $scenario only when it may be hidden', ({ tabId, hidden }) => {
    const next = setTabHidden(series(), tabId, true);

    expect(next.tabs.find(({ id }) => id === tabId)?.hidden).toBe(hidden);
  });

  it('renames a tab and sets where each audience lands', () => {
    const next = setLanding(renameTab(series(), 'videos', 'Clips'), 'subscriber', 'episodes');

    expect(next.tabs.find(({ id }) => id === 'videos')?.title).toBe('Clips');
    expect(next.landing).toEqual({ visitor: 'home', subscriber: 'episodes' });
  });

  it('adds custom tabs with fresh ids and addresses, up to the cap', () => {
    const layout = withCustomTabs(LAYOUT_LIMITS.customTabs + 1);
    const custom = layout.tabs.filter(({ kind }) => kind === 'custom');

    expect(custom).toHaveLength(LAYOUT_LIMITS.customTabs);
    expect(new Set(custom.map(({ id }) => id)).size).toBe(LAYOUT_LIMITS.customTabs);
    expect(canAddTab(layout)).toBe(false);
  });

  it('duplicates a custom tab with its sections under new ids, next to it', () => {
    const layout = series();
    const next = duplicateTab(layout, 'episodes');
    const [copy] = next.tabs.slice(next.tabs.findIndex(({ id }) => id === 'episodes') + 1);

    expect(copy?.kind === 'custom' && copy.slug).toBe('episodes-1');
    expect(sectionsOf(next).map(({ id }) => id)).toHaveLength(sectionsOf(layout).length + 1);
    expect(new Set(sectionsOf(next).map(({ id }) => id)).size).toBe(sectionsOf(next).length);
    expect(duplicateTab(layout, 'videos')).toBe(layout);
  });

  it('removes a custom tab and sends what pointed at it back to Home', () => {
    const pointed = setLanding(series(), 'visitor', 'episodes');
    const next = removeTab(pointed, 'episodes');

    expect(idsOf(next)).not.toContain('episodes');
    expect(next.landing.visitor).toBe('home');
    expect(
      sectionsOf(next).every(
        (section) => section.kind !== 'content' || section.seeAll !== 'episodes'
      )
    ).toBe(true);
    expect(removeTab(pointed, 'home')).toBe(pointed);
  });

  it('edits a custom tab', () => {
    const next = updateCustomTab(series(), 'episodes', { slug: 'shows', icon: 'video' });
    const tab = next.tabs.find(({ id }) => id === 'episodes');

    expect(tab?.kind === 'custom' && [tab.slug, tab.icon]).toEqual(['shows', 'video']);
  });

  it.each(SECTION_BLOCKS)('adds a %s section to Home', (block) => {
    const next = addSection(standardChannelLayout(), 'home', block, 'New');
    const added = tabSections(next.tabs[0] as ChannelLayout['tabs'][number]).at(-1);

    expect(added?.presentation.title).toEqual({ default: 'New' });
    expect(added?.kind).toBe(
      block === 'rich_text' || block === 'links' || block === 'featured_channels'
        ? block
        : 'content'
    );
  });

  it('refuses a section past the cap on a tab', () => {
    const full = Array.from({ length: LAYOUT_LIMITS.sectionsPerTab }).reduce<ChannelLayout>(
      (layout) => addSection(layout, 'home', 'videos', 'More'),
      {
        ...standardChannelLayout(),
        tabs: standardChannelLayout().tabs.map((tab) =>
          tab.kind === 'home' ? { ...tab, sections: [] } : tab
        ),
      }
    );

    expect(canAddSection(full, 'home')).toBe(false);
    expect(addSection(full, 'home', 'videos', 'One more')).toBe(full);
  });

  it('duplicates, hides, shows, replaces and deletes a section in place', () => {
    const layout = standardChannelLayout();
    const copied = duplicateSection(layout, 'latest');
    const hidden = setSectionHidden(layout, 'latest', true);
    const first = sectionsOf(layout)[1];

    expect(homeIds(copied)).toEqual(['start-here', 'latest', 'latest-1']);
    expect(isSectionHidden(sectionsOf(hidden)[1] as NonNullable<typeof first>)).toBe(true);
    expect(
      isSectionHidden(
        sectionsOf(setSectionHidden(hidden, 'latest', false))[1] as NonNullable<typeof first>
      )
    ).toBe(false);
    expect(findSectionTab(layout, 'latest')?.id).toBe('home');
    expect(
      homeIds(
        removeSection(
          replaceSection(layout, {
            ...(first as NonNullable<typeof first>),
            hideWhenEmpty: false,
          } as NonNullable<typeof first>),
          'start-here'
        )
      )
    ).toEqual(['latest']);
  });
});
