import { type ChannelLayout, standardChannelLayout, type LayoutSection } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { addCustomTab, addSection, updateCustomTab } from '../layout-edits';
import { layoutProblem } from '../layout-problem';

const withRichText = (body: string): ChannelLayout => {
  const added = addSection(standardChannelLayout(), 'home', 'rich_text', 'About me');
  return {
    ...added,
    tabs: added.tabs.map((tab) =>
      tab.kind === 'home'
        ? {
            ...tab,
            sections: tab.sections.map((s): LayoutSection =>
              s.kind === 'rich_text' ? { ...s, body } : s
            ),
          }
        : tab
    ),
  };
};

const badSlug = () =>
  updateCustomTab(addCustomTab(standardChannelLayout(), 'Tab'), 'tab-1', { slug: 'x' });

const aboutHidden = (): ChannelLayout => ({
  ...standardChannelLayout(),
  tabs: standardChannelLayout().tabs.map((tab) =>
    tab.kind === 'about' ? { ...tab, hidden: true } : tab
  ),
});

describe('apps/client/studio: layout problem', () => {
  it('finds nothing in a sound layout', () => {
    expect(layoutProblem(standardChannelLayout())).toBeNull();
  });

  it.each([
    {
      scenario: 'a slug that is not an address',
      layout: badSlug(),
      expected: {
        code: ErrorCodes.LAYOUT_SLUG_INVALID,
        target: { tabId: 'tab-1', sectionId: null },
      },
    },
    {
      scenario: 'Markdown with HTML, in its section',
      layout: withRichText('<b>no</b>'),
      expected: {
        code: ErrorCodes.LAYOUT_MARKDOWN_INVALID,
        target: { tabId: 'home', sectionId: 'section-1' },
      },
    },
    {
      scenario: 'a pinned tab that is hidden, at its tab',
      layout: aboutHidden(),
      expected: {
        code: ErrorCodes.LAYOUT_STRUCTURE_INVALID,
        target: { tabId: 'about', sectionId: null },
      },
    },
  ])('names $scenario and where to open it', ({ layout, expected }) => {
    expect(layoutProblem(layout)).toEqual(expected);
  });
});
