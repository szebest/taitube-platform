import { type Result, assertNever, err, ok } from '@kit/result';
import { type ChannelLayout, tabSections } from '@vp/domain';
import { richTextImageIds, richTextTree } from '@vp/validation';
import {
  type LayoutReferenceInvalid,
  type LayoutReferenceKind,
  layoutReferenceInvalid,
} from './failures';

export interface LayoutReference {
  readonly kind: LayoutReferenceKind;
  readonly id: string;
}

interface LayoutReferenceFact extends LayoutReference {
  readonly channelId: string | null;
  readonly ownerUserId: string | null;
}

export interface LayoutReferenceScope {
  readonly channelId: string;
  readonly ownerUserId: string;
  readonly facts: readonly LayoutReferenceFact[];
}

export function layoutReferences(layout: ChannelLayout): LayoutReference[] {
  const found: LayoutReference[] = [];
  for (const tab of layout.tabs) {
    if (tab.kind === 'custom' && tab.header) found.push({ kind: 'page-image', id: tab.header });
  }
  for (const section of layout.tabs.flatMap(tabSections)) {
    if (section.presentation.background) {
      found.push({ kind: 'page-image', id: section.presentation.background });
    }
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
        found.push(
          ...richTextImageIds(richTextTree(section.body)).map((id) => ({
            kind: 'page-image' as const,
            id,
          }))
        );
        break;
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
    case 'page-image':
      return fact.channelId === scope.channelId;
    case 'playlist':
      return fact.ownerUserId === scope.ownerUserId;
    case 'channel':
      return true;
    default:
      return assertNever(reference.kind, 'LayoutReferenceKind');
  }
}

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
