import { type Result, assertNever, err, ok } from '@kit/result';
import { type ChannelLayout, tabSections } from '@vp/domain';
import {
  type LayoutReferenceInvalid,
  type LayoutReferenceKind,
  layoutReferenceInvalid,
} from './failures';

export interface LayoutReference {
  readonly kind: LayoutReferenceKind;
  readonly id: string;
}

/** What a public item looks like to the rule: the channel or the account that owns it, when it has one. */
export interface LayoutReferenceFact extends LayoutReference {
  readonly channelId: string | null;
  readonly ownerUserId: string | null;
}

export interface LayoutReferenceScope {
  readonly channelId: string;
  readonly ownerUserId: string;
  readonly facts: readonly LayoutReferenceFact[];
}

/** Every video, playlist, post and channel the document names, once each, in document order. */
export function layoutReferences(layout: ChannelLayout): LayoutReference[] {
  const found: LayoutReference[] = [];
  for (const section of layout.tabs.flatMap(tabSections)) {
    switch (section.kind) {
      case 'content':
        if (section.source.type === 'playlist') {
          found.push({ kind: 'playlist', id: section.source.playlistId });
        }
        if (section.source.type === 'picked') found.push(...section.source.items);
        break;
      case 'featured_channels':
        found.push(...section.channelIds.map((id) => ({ kind: 'channel' as const, id })));
        break;
      case 'rich_text':
      case 'links':
        break;
      default:
        return assertNever(section, 'LayoutSection');
    }
  }
  const unique = new Map(
    found.map((reference) => [`${reference.kind}:${reference.id}`, reference])
  );
  return [...unique.values()];
}

function belongs(
  reference: LayoutReference,
  fact: LayoutReferenceFact,
  scope: LayoutReferenceScope
): boolean {
  switch (reference.kind) {
    case 'video':
    case 'post':
      return fact.channelId === scope.channelId;
    case 'playlist':
      return fact.ownerUserId === scope.ownerUserId;
    case 'channel':
      return true;
    default:
      return assertNever(reference.kind, 'LayoutReferenceKind');
  }
}

/**
 * A picked video or post exists, is public and is the channel's own, a playlist is the account's,
 * and a featured channel exists. `facts` holds only what is public, so a missing one is absent,
 * private or someone else's, and the refusal tells which is none of them.
 */
export function decideLayoutReferences(
  layout: ChannelLayout,
  scope: LayoutReferenceScope
): Result<ChannelLayout, LayoutReferenceInvalid> {
  for (const reference of layoutReferences(layout)) {
    const fact = scope.facts.find(({ kind, id }) => kind === reference.kind && id === reference.id);
    if (!fact || !belongs(reference, fact, scope)) {
      return err(layoutReferenceInvalid(reference.kind, reference.id));
    }
  }
  return ok(layout);
}
