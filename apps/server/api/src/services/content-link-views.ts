import type { ContentLinkView, LinkedItem } from '@vp/api-contracts';
import type { ContentLinkStatCounts, ResolvedContent } from '@vp/core/repositories';
import { type ContentLink, contentRefKey } from '@vp/domain';
import { canReadVideo, type UserContext } from '@vp/permissions';

/** Anyone sees public content; private content goes to whoever the matrix lets read a private video of its channel. */
export function canSeeContent(viewer: UserContext | null, content: ResolvedContent): boolean {
  return (
    content.public ||
    canReadVideo({
      user: viewer,
      video: {
        ownerId: content.ownerId,
        channelId: content.channelId,
        visibility: 'private',
        status: 'READY',
      },
    })
  );
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
