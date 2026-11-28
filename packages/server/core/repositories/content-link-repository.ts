import type { Result } from '@kit/result';
import type {
  ContentLink,
  ContentLinkRelation,
  ContentLinkStatus,
  ContentRef,
  LinkPolicy,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export type LinkDirection = 'outgoing' | 'incoming';

/** One stored link as seen from one of the refs asked for. */
export interface TouchingLink {
  direction: LinkDirection;
  ref: ContentRef;
  link: ContentLink;
}

/**
 * The stored link graph. It keeps what was written, whatever state each end is in since: which
 * links a viewer may see is the service's decision.
 */
export interface ContentLinkRepositoryPort {
  /** `null` when the source, target and relation already hold a row, whatever its status. */
  insert(link: ContentLink): Promise<Result<ContentLink | null, DatabaseUnavailable>>;
  findById(id: string): Promise<Result<ContentLink | null, DatabaseUnavailable>>;
  findByEdge(
    source: ContentRef,
    target: ContentRef,
    relation: ContentLinkRelation
  ): Promise<Result<ContentLink | null, DatabaseUnavailable>>;
  /** The updated link, or `null` when it is gone or no longer in one of the `from` statuses. */
  transition(
    id: string,
    from: readonly ContentLinkStatus[],
    to: ContentLinkStatus,
    decidedBy: string | null
  ): Promise<Result<ContentLink | null, DatabaseUnavailable>>;
  remove(id: string): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Active links of every ref asked for, outgoing and incoming, in one read. */
  touching(refs: readonly ContentRef[]): Promise<Result<TouchingLink[], DatabaseUnavailable>>;
  /** Links the source holds that count against its cap: active and pending. */
  countOutgoing(source: ContentRef): Promise<Result<number, DatabaseUnavailable>>;
  /** Links the channel's own content holds that count against its cap: active and pending. */
  countForChannel(channelId: string): Promise<Result<number, DatabaseUnavailable>>;
  /** The channel's chain edges of one relation, from each source key to the keys it points at. */
  chainEdges(
    channelId: string,
    relation: ContentLinkRelation
  ): Promise<Result<Map<string, string[]>, DatabaseUnavailable>>;
  /** Newest first. */
  listByTargetChannel(
    channelId: string,
    statuses: readonly ContentLinkStatus[],
    limit: number
  ): Promise<Result<ContentLink[], DatabaseUnavailable>>;
  /** Newest first. */
  listBySourceChannel(
    channelId: string,
    statuses: readonly ContentLinkStatus[],
    limit: number
  ): Promise<Result<ContentLink[], DatabaseUnavailable>>;
  /** Links whose target is this content, any status: the rows a hard delete turns `broken`. */
  markTargetBroken(target: ContentRef): Promise<Result<number, DatabaseUnavailable>>;
  /** Rows the viewer created since `since` that are still `suggested` or were `declined`. */
  countSuggestedBy(viewerId: string, since: Date): Promise<Result<number, DatabaseUnavailable>>;
  linkPolicy(channelId: string): Promise<Result<LinkPolicy, DatabaseUnavailable>>;
  setLinkPolicy(channelId: string, policy: LinkPolicy): Promise<Result<void, DatabaseUnavailable>>;
}
