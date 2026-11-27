import { type Result, isErr } from '@kit/result';
import type {
  ChannelImageRepositoryPort,
  ChannelLayoutRepositoryPort,
  ChannelPageSourceRepositoryPort,
} from '@vp/core/repositories';
import type { ActingChannel, ChannelLayout } from '@vp/domain';
import {
  type LayoutDocumentFailure,
  type LayoutReferenceInvalid,
  decideLayoutDocument,
  decideLayoutReferences,
  layoutReferences,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import { readStoredLayout } from './channel-layout-document';

export interface LayoutCheckDeps {
  layouts: Pick<ChannelLayoutRepositoryPort, 'getPublished'>;
  sources: Pick<ChannelPageSourceRepositoryPort, 'hydrate'>;
  images: Pick<ChannelImageRepositoryPort, 'findReadyImages'>;
}

export type LayoutCheckFailure =
  | LayoutDocumentFailure
  | LayoutReferenceInvalid
  | DatabaseUnavailable;

export async function checkLayout(
  { layouts, sources, images }: LayoutCheckDeps,
  acting: ActingChannel,
  document: ChannelLayout
): Promise<Result<ChannelLayout, LayoutCheckFailure>> {
  const live = await layouts.getPublished(acting.channelId);
  if (isErr(live)) return live;
  const decided = decideLayoutDocument(document, readStoredLayout(live.value?.document));
  if (isErr(decided)) return decided;
  const references = layoutReferences(decided.value);
  const pageImages = references.flatMap(({ kind, id }) => (kind === 'page-image' ? [id] : []));
  const hydrated = await sources.hydrate(
    references.flatMap(({ kind, id }) => (kind === 'page-image' ? [] : [{ kind, id }]))
  );
  if (isErr(hydrated)) return hydrated;
  const ready = await images.findReadyImages('page-image', acting.channelId, pageImages);
  if (isErr(ready)) return ready;
  return decideLayoutReferences(decided.value, {
    channelId: acting.channelId,
    ownerUserId: acting.ownerId,
    facts: [
      ...hydrated.value.flatMap(({ kind, id, channelId, ownerUserId }) =>
        kind === 'live' ? [] : [{ kind, id, channelId, ownerUserId }]
      ),
      ...ready.value.map(({ uploadId }) => ({
        kind: 'page-image' as const,
        id: uploadId,
        channelId: acting.channelId,
        ownerUserId: null,
      })),
    ],
  });
}
