import { type ChannelLayout, type ContentSection, standardChannelLayout } from '@vp/domain';
import { ChannelLayoutSchema } from '../channel-layout';

function homeSection(): ContentSection {
  const home = standardChannelLayout().tabs[0];
  const section = home?.kind === 'home' ? home.sections[0] : undefined;
  if (section?.kind !== 'content')
    throw new Error('the default Home starts with a content section');
  return section;
}

function layoutWithSection(section: object): unknown {
  const base = standardChannelLayout();
  const [home, ...rest] = base.tabs;
  return { ...base, tabs: [{ ...home, sections: [section] }, ...rest] };
}

describe('packages/api-contracts: ChannelLayoutSchema', () => {
  it('parses the default layout unchanged', () => {
    const layout = standardChannelLayout();

    expect(ChannelLayoutSchema.parse(layout)).toEqual(layout);
  });

  it.each([
    { scenario: 'a hero of three items', patch: { layout: { type: 'hero' }, itemCount: 3 } },
    { scenario: 'masonry over Start here', patch: { layout: { type: 'masonry' } } },
    {
      scenario: 'manual order over all videos',
      patch: { source: { type: 'videos' }, sort: 'manual' },
    },
    { scenario: 'a grid of seven columns', patch: { layout: { type: 'grid', columns: 7 } } },
    { scenario: 'twenty-five items', patch: { itemCount: 25 } },
    { scenario: 'an unknown field', patch: { surprise: true } },
  ])('refuses $scenario', ({ patch }) => {
    const parsed = ChannelLayoutSchema.safeParse(layoutWithSection({ ...homeSection(), ...patch }));

    expect(parsed.success).toBe(false);
  });

  it('refuses an accent that is not a hex colour', () => {
    const section = homeSection();
    const accented = { ...section, presentation: { ...section.presentation, accent: 'red' } };

    expect(ChannelLayoutSchema.safeParse(layoutWithSection(accented)).success).toBe(false);
  });

  it('leaves the caps to the rules, so an eleventh tab still parses', () => {
    const base = standardChannelLayout();
    const extra: ChannelLayout['tabs'] = Array.from({ length: 5 }, (_, index) => ({
      kind: 'videos',
      id: `extra-${index}`,
      title: 'Extra',
      hidden: false,
      visibility: { audience: 'everyone', from: null, to: null, locales: [] },
    }));

    const parsed = ChannelLayoutSchema.safeParse({ ...base, tabs: [...base.tabs, ...extra] });

    expect(parsed.success).toBe(true);
  });
});
