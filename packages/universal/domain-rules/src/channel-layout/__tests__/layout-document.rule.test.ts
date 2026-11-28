import { expectErr, expectOk } from '@kit/testing/result';
import { standardChannelLayout } from '@vp/domain';
import { decideLayoutDocument } from '../layout-document.rule';
import { contentSection, customTab, layoutWith, layoutWithHomeSections } from './layout-fixtures';

const richText = (body: string) => ({
  kind: 'rich_text' as const,
  id: 'about-me',
  body,
  presentation: contentSection('x').presentation,
  visibility: contentSection('x').visibility,
});

describe('@vp/domain-rules: decideLayoutDocument', () => {
  it('lets a sound document through', () => {
    expectOk(
      decideLayoutDocument(
        layoutWithHomeSections(richText('Hello **there**')),
        standardChannelLayout()
      )
    );
  });

  it.each([
    {
      scenario: 'Markdown with HTML',
      layout: layoutWithHomeSections(richText('<script>alert(1)</script>')),
      code: 'LAYOUT_MARKDOWN_INVALID',
    },
    {
      scenario: 'Markdown with an image URL',
      layout: layoutWithHomeSections(richText('![x](https://example.com/a.png)')),
      code: 'LAYOUT_MARKDOWN_INVALID',
    },
    {
      scenario: 'a reserved slug',
      layout: layoutWith(customTab('c', 'live')),
      code: 'LAYOUT_SLUG_INVALID',
    },
    {
      scenario: 'a layout without About',
      layout: { ...standardChannelLayout(), tabs: standardChannelLayout().tabs.slice(0, 3) },
      code: 'LAYOUT_STRUCTURE_INVALID',
    },
  ])('refuses $scenario with its own code', ({ layout, code }) => {
    expect(expectErr(decideLayoutDocument(layout, null)).code).toBe(code);
  });
});
