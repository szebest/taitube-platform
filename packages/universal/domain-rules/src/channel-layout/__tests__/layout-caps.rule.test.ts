import { expectErr, expectOk } from '@kit/testing/result';
import { type ChannelLayout, standardChannelLayout } from '@vp/domain';
import { decideLayoutCaps } from '../layout-caps.rule';
import { contentSection, customTab, layoutWith, layoutWithHomeSections } from './layout-fixtures';

const sections = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => contentSection(`${prefix}-${index}`));

const customTabs = (count: number): ChannelLayout =>
  layoutWith(
    ...Array.from({ length: count }, (_, index) => customTab(`c${index}`, `custom-${index}`))
  );

const picked = (count: number) =>
  contentSection('picked', {
    source: {
      type: 'picked',
      items: Array.from({ length: count }, (_, index) => ({
        kind: 'video' as const,
        id: `0195a1b2-c3d4-7e5f-8a6b-${String(index).padStart(12, '0')}`,
      })),
    },
    sort: 'manual',
  });

describe('@vp/domain-rules: decideLayoutCaps', () => {
  it.each([
    { scenario: 'the default layout', layout: standardChannelLayout() },
    { scenario: 'four custom tabs', layout: customTabs(4) },
    { scenario: 'twenty sections on a tab', layout: layoutWithHomeSections(...sections(20, 'a')) },
    { scenario: 'twenty-four picked items', layout: layoutWithHomeSections(picked(24)) },
  ])('lets $scenario through', ({ layout }) => {
    expectOk(decideLayoutCaps(layout));
  });

  it.each([
    { scenario: 'an 11th tab', layout: customTabs(5), limit: 'tabs', max: 10, actual: 11 },
    {
      scenario: 'a 5th custom tab',
      layout: { ...customTabs(5), tabs: customTabs(5).tabs.filter((tab) => tab.kind !== 'about') },
      limit: 'custom_tabs',
      max: 4,
      actual: 5,
    },
    {
      scenario: 'a 21st section on a tab',
      layout: layoutWithHomeSections(...sections(21, 'a')),
      limit: 'sections_per_tab',
      max: 20,
      actual: 21,
    },
    {
      scenario: 'a 61st section in the layout',
      layout: layoutWith(
        customTab('x', 'tab-x', sections(20, 'x')),
        customTab('y', 'tab-y', sections(20, 'y')),
        customTab('z', 'tab-z', sections(18, 'z')),
        customTab('w', 'tab-w', sections(1, 'w'))
      ),
      limit: 'sections',
      max: 60,
      actual: 61,
    },
    {
      scenario: 'a 25th picked item',
      layout: layoutWithHomeSections(picked(25)),
      limit: 'picked_items',
      max: 24,
      actual: 25,
    },
    {
      scenario: 'a document over 128 KB',
      layout: layoutWith({
        ...customTab('big', 'big-tab'),
        description: 'x'.repeat(200_000),
      }),
      limit: 'document_bytes',
      max: 131_072,
      actual: expect.any(Number),
    },
  ])('refuses $scenario', ({ layout, limit, max, actual }) => {
    expect(expectErr(decideLayoutCaps(layout))).toMatchObject({
      code: 'LAYOUT_LIMIT_EXCEEDED',
      limit,
      max,
      actual,
    });
  });
});
