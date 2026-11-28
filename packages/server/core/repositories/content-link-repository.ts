import type { Result } from '@kit/result';
import type {
  ContentLink,
  ContentLinkRelation,
  ContentLinkStatus,
  ContentRef,
  LinkPolicy,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

/** What a write is decided on: read under the same lock as the insert it guards. */
export interface LinkWriteState {
  /** Links the source holds that count against its cap: active and pending. */
  outgoing: number;
  /** Links the channel's own content holds that count against its cap: active and pending. */
  channelTotal: number;
  /** The channel's chain edges of the link's relation, from each source key to the keys it points at. */
  chainEdges: Map<string, string[]>;
}

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
  /** `null` when the source, target and relation already hold a row that is not declined. */
  insert(link: ContentLink): Promise<Result<ContentLink | null, DatabaseUnavailable>>;
  /**
   * `insert` after `guard` has passed on the state of the source's channel, both inside one
   * transaction under a lock on that channel, so two writers cannot pass a cap or close a loop together.
   */
  insertGuarded<E>(
    link: ContentLink,
    guard: (state: LinkWriteState) => Result<void, E>
  ): Promise<Result<ContentLink | null, DatabaseUnavailable | E>>;
  /**
   * `transition` of `link` after `guard` has passed on the state of its source's channel, under
   * the same lock as `insertGuarded`: accepting a suggestion is a write that adds a link.
   */
  transitionGuarded<E>(
    link: ContentLink,
    from: readonly ContentLinkStatus[],
    to: ContentLinkStatus,
    decidedBy: string,
    guard: (state: LinkWriteState) => Result<void, E>
  ): Promise<Result<ContentLink | null, DatabaseUnavailable | E>>;
  findById(id: string): Promise<Result<ContentLink | null, DatabaseUnavailable>>;
  /** The row of this edge that is not declined, whatever else was once declined. */
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
  /** Active and pending links into this content: the rows a hard delete turns `broken`. */
  markTargetBroken(target: ContentRef): Promise<Result<number, DatabaseUnavailable>>;
  /** Rows of viewer origin the viewer created since `since`, whatever became of them. */
  countSuggestedBy(viewerId: string, since: Date): Promise<Result<number, DatabaseUnavailable>>;
  linkPolicy(channelId: string): Promise<Result<LinkPolicy, DatabaseUnavailable>>;
  setLinkPolicy(channelId: string, policy: LinkPolicy): Promise<Result<void, DatabaseUnavailable>>;
}
