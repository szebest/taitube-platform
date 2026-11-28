import { type Result, isErr } from '@kit/result';
import type {
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
}

export type LayoutCheckFailure =
  | LayoutDocumentFailure
  | LayoutReferenceInvalid
  | DatabaseUnavailable;

export async function checkLayout(
  { layouts, sources }: LayoutCheckDeps,
  acting: ActingChannel,
  document: ChannelLayout
): Promise<Result<ChannelLayout, LayoutCheckFailure>> {
  const live = await layouts.getPublished(acting.channelId);
  if (isErr(live)) return live;
  const decided = decideLayoutDocument(document, readStoredLayout(live.value?.document));
  if (isErr(decided)) return decided;
  const hydrated = await sources.hydrate(layoutReferences(decided.value));
  if (isErr(hydrated)) return hydrated;
  return decideLayoutReferences(decided.value, {
    channelId: acting.channelId,
    ownerUserId: acting.ownerId,
    facts: hydrated.value.flatMap(({ kind, id, channelId, ownerUserId }) =>
      kind === 'live' ? [] : [{ kind, id, channelId, ownerUserId }]
    ),
  });
}
