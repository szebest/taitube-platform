import { type Result, err, ok } from '@kit/result';
import { type ChannelLayout, type CustomTab, RESERVED_TAB_SLUGS } from '@vp/domain';
import { type LayoutSlugInvalid, layoutSlugInvalid } from './failures';

const SLUG_PATTERN = /^[a-z0-9-]{3,30}$/;

function customTabs(layout: ChannelLayout | null): CustomTab[] {
  return layout?.tabs.filter((tab): tab is CustomTab => tab.kind === 'custom') ?? [];
}

export function decideLayoutSlugs(
  layout: ChannelLayout,
  published: ChannelLayout | null
): Result<ChannelLayout, LayoutSlugInvalid> {
  const live = new Map(customTabs(published).map(({ id, slug }) => [id, slug]));
  const seen = new Set<string>();
  for (const { id, slug } of customTabs(layout)) {
    if (!SLUG_PATTERN.test(slug)) return err(layoutSlugInvalid(slug, 'format'));
    if (RESERVED_TAB_SLUGS.includes(slug)) return err(layoutSlugInvalid(slug, 'reserved'));
    if (seen.has(slug)) return err(layoutSlugInvalid(slug, 'taken'));
    seen.add(slug);
    const before = live.get(id);
    if (before !== undefined && before !== slug) return err(layoutSlugInvalid(slug, 'changed'));
  }
  return ok(layout);
}
