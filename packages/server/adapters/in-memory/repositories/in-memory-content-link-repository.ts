import { ok, type Result } from '@kit/result';
import type {
  ContentLinkRepositoryPort,
  LinkWriteState,
  TouchingLink,
} from '@vp/core/repositories';
import {
  CHAIN_RELATIONS,
  type ContentLink,
  type ContentLinkRelation,
  type ContentLinkStatus,
  type ContentRef,
  contentRefKey,
  DEFAULT_LINK_POLICY,
  type LinkPolicy,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

const COUNTED: readonly ContentLinkStatus[] = ['active', 'pending'];

const edgeKey = (link: ContentLink) =>
  `${contentRefKey(link.source)}>${contentRefKey(link.target)}>${link.params.relation}`;

const newestFirst = (a: ContentLink, b: ContentLink) =>
  b.createdAt.getTime() - a.createdAt.getTime();

export class InMemoryContentLinkRepository implements ContentLinkRepositoryPort {
  private readonly links = new Map<string, ContentLink>();
  private readonly policies = new Map<string, LinkPolicy>();

  async insert(link: ContentLink): Promise<Result<ContentLink | null, DatabaseUnavailable>> {
    const taken = [...this.links.values()].some(
      (held) => held.status !== 'declined' && edgeKey(held) === edgeKey(link)
    );
    if (taken) return ok(null);
    this.links.set(link.id, link);
    return ok(link);
  }

  async insertGuarded<E>(
    link: ContentLink,
    guard: (state: LinkWriteState) => Result<void, E>
  ): Promise<Result<ContentLink | null, DatabaseUnavailable | E>> {
    const decided = guard({
      outgoing: this.outgoingOf(link.source),
      channelTotal: this.totalOf(link.sourceChannelId),
      chainEdges: this.edgesOf(link.sourceChannelId, link.params.relation),
    });
    if (!decided.ok) return decided;
    return this.insert(link);
  }

  async transitionGuarded<E>(
    link: ContentLink,
    from: readonly ContentLinkStatus[],
    to: ContentLinkStatus,
    decidedBy: string,
    guard: (state: LinkWriteState) => Result<void, E>
  ): Promise<Result<ContentLink | null, DatabaseUnavailable | E>> {
    const decided = guard({
      outgoing: this.outgoingOf(link.source),
      channelTotal: this.totalOf(link.sourceChannelId),
      chainEdges: this.edgesOf(link.sourceChannelId, link.params.relation),
    });
    if (!decided.ok) return decided;
    return this.transition(link.id, from, to, decidedBy);
  }

  async findById(id: string): Promise<Result<ContentLink | null, DatabaseUnavailable>> {
    return ok(this.links.get(id) ?? null);
  }

  async findByEdge(
    source: ContentRef,
    target: ContentRef,
    relation: ContentLinkRelation
  ): Promise<Result<ContentLink | null, DatabaseUnavailable>> {
    const key = `${contentRefKey(source)}>${contentRefKey(target)}>${relation}`;
    return ok(
      [...this.links.values()].find(
        (link) => link.status !== 'declined' && edgeKey(link) === key
      ) ?? null
    );
  }

  async transition(
    id: string,
    from: readonly ContentLinkStatus[],
    to: ContentLinkStatus,
    decidedBy: string | null
  ): Promise<Result<ContentLink | null, DatabaseUnavailable>> {
    const held = this.links.get(id);
    if (!held || !from.includes(held.status)) return ok(null);
    const next = { ...held, status: to, decidedBy };
    this.links.set(id, next);
    return ok(next);
  }

  async remove(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    return ok(this.links.delete(id));
  }

  async touching(
    refs: readonly ContentRef[]
  ): Promise<Result<TouchingLink[], DatabaseUnavailable>> {
    const wanted = new Map(refs.map((ref) => [contentRefKey(ref), ref]));
    const found: TouchingLink[] = [];
    for (const link of [...this.links.values()].sort(newestFirst)) {
      if (link.status !== 'active') continue;
      const outgoing = wanted.get(contentRefKey(link.source));
      if (outgoing) found.push({ direction: 'outgoing', ref: outgoing, link });
      const incoming = wanted.get(contentRefKey(link.target));
      if (incoming) found.push({ direction: 'incoming', ref: incoming, link });
    }
    return ok(found);
  }

  async countOutgoing(source: ContentRef): Promise<Result<number, DatabaseUnavailable>> {
    return ok(this.outgoingOf(source));
  }

  async countForChannel(channelId: string): Promise<Result<number, DatabaseUnavailable>> {
    return ok(this.totalOf(channelId));
  }

  async chainEdges(
    channelId: string,
    relation: ContentLinkRelation
  ): Promise<Result<Map<string, string[]>, DatabaseUnavailable>> {
    return ok(this.edgesOf(channelId, relation));
  }

  async listByTargetChannel(
    channelId: string,
    statuses: readonly ContentLinkStatus[],
    limit: number
  ): Promise<Result<ContentLink[], DatabaseUnavailable>> {
    return ok(this.list((link) => link.targetChannelId === channelId, statuses, limit));
  }

  async listBySourceChannel(
    channelId: string,
    statuses: readonly ContentLinkStatus[],
    limit: number
  ): Promise<Result<ContentLink[], DatabaseUnavailable>> {
    return ok(this.list((link) => link.sourceChannelId === channelId, statuses, limit));
  }

  async markTargetBroken(target: ContentRef): Promise<Result<number, DatabaseUnavailable>> {
    const key = contentRefKey(target);
    let marked = 0;
    for (const link of this.links.values()) {
      if (contentRefKey(link.target) !== key || !COUNTED.includes(link.status)) continue;
      this.links.set(link.id, { ...link, status: 'broken' });
      marked += 1;
    }
    return ok(marked);
  }

  async countSuggestedBy(
    viewerId: string,
    since: Date
  ): Promise<Result<number, DatabaseUnavailable>> {
    return ok(
      [...this.links.values()].filter(
        (link) => link.origin === 'viewer' && link.createdBy === viewerId && link.createdAt >= since
      ).length
    );
  }

  async linkPolicy(channelId: string): Promise<Result<LinkPolicy, DatabaseUnavailable>> {
    return ok(this.policies.get(channelId) ?? DEFAULT_LINK_POLICY);
  }

  async setLinkPolicy(
    channelId: string,
    policy: LinkPolicy
  ): Promise<Result<void, DatabaseUnavailable>> {
    this.policies.set(channelId, policy);
    return ok();
  }

  clear(): void {
    this.links.clear();
    this.policies.clear();
  }

  private outgoingOf(source: ContentRef): number {
    const key = contentRefKey(source);
    return [...this.links.values()].filter(
      (link) => contentRefKey(link.source) === key && COUNTED.includes(link.status)
    ).length;
  }

  private totalOf(channelId: string): number {
    return [...this.links.values()].filter(
      (link) => link.sourceChannelId === channelId && COUNTED.includes(link.status)
    ).length;
  }

  private edgesOf(channelId: string, relation: ContentLinkRelation): Map<string, string[]> {
    const edges = new Map<string, string[]>();
    if (!CHAIN_RELATIONS.includes(relation)) return edges;
    for (const link of this.links.values()) {
      if (link.sourceChannelId !== channelId || link.params.relation !== relation) continue;
      if (!COUNTED.includes(link.status)) continue;
      const key = contentRefKey(link.source);
      edges.set(key, [...(edges.get(key) ?? []), contentRefKey(link.target)]);
    }
    return edges;
  }

  private list(
    keep: (link: ContentLink) => boolean,
    statuses: readonly ContentLinkStatus[],
    limit: number
  ): ContentLink[] {
    return [...this.links.values()]
      .filter((link) => keep(link) && statuses.includes(link.status))
      .sort(newestFirst)
      .slice(0, limit);
  }
}
