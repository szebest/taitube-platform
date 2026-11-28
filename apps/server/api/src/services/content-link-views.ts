import type { ContentLinkView, LinkedItem } from '@vp/api-contracts';
import type { ContentLinkStatCounts, ResolvedContent } from '@vp/core/repositories';
import { type ContentLink, contentRefKey } from '@vp/domain';
import type { UserContext } from '@vp/permissions';

/** The viewer's own content, or their channel's, or anything public. */
export function canSeeContent(viewer: UserContext | null, content: ResolvedContent): boolean {
  if (content.public) return true;
  if (!viewer) return false;
  return content.ownerId === viewer.id || viewer.memberships?.[content.channelId] !== undefined;
}

export function toLinkedItem(
  content: ResolvedContent,
  progress: LinkedItem['progress'] = null
): LinkedItem {
  return {
    ref: content.ref,
    title: content.title,
    channelId: content.channelId,
    mediaVideoId: content.mediaVideoId,
    durationMs: content.durationMs,
    format: content.format,
    progress,
  };
}

export function toLinkView(
  link: ContentLink,
  options: {
    viewer: UserContext;
    contents: ReadonlyMap<string, ResolvedContent>;
    stats: ReadonlyMap<string, ContentLinkStatCounts> | null;
  }
): ContentLinkView {
  const titleOf = (ref: ContentLink['source']) => {
    const content = options.contents.get(contentRefKey(ref));
    return content && canSeeContent(options.viewer, content) ? content.title : null;
  };
  return {
    id: link.id,
    source: link.source,
    target: link.target,
    params: link.params,
    anchors: link.anchors,
    status: link.status,
    sourceChannelId: link.sourceChannelId,
    targetChannelId: link.targetChannelId,
    origin: link.origin,
    createdBy: link.createdBy,
    decidedBy: link.decidedBy,
    createdAt: link.createdAt.toISOString(),
    sourceTitle: titleOf(link.source),
    targetTitle: titleOf(link.target),
    stats: options.stats?.get(link.id) ?? null,
  };
}
