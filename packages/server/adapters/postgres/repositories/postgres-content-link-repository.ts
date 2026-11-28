import { fromPromise, map, ok, type Result } from '@kit/result';
import type { ContentLinkRepositoryPort, TouchingLink } from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type ContentLink,
  type ContentLinkRelation,
  type ContentLinkStatus,
  type ContentRef,
  contentRefKey,
  DEFAULT_LINK_POLICY,
  type LinkPolicy,
  toStoredRef,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { unionAll } from 'drizzle-orm/pg-core';
import { linkFromRow, linkToRow } from './content-link-rows';
import type { PostgresDatabase } from './types';

const { contentLinks: cl, channelLinkSettings: settings } = schema;

const COUNTED: ContentLinkStatus[] = ['active', 'pending'];
const VIEWER_SUGGESTION_STATUSES: ContentLinkStatus[] = ['suggested', 'declined'];

function refsMatch(
  type: typeof cl.sourceType | typeof cl.targetType,
  id: typeof cl.sourceId | typeof cl.targetId,
  refs: readonly ContentRef[]
): SQL | undefined {
  const byType = new Map<string, string[]>();
  for (const ref of refs) {
    const stored = toStoredRef(ref);
    byType.set(stored.type, [...(byType.get(stored.type) ?? []), stored.id]);
  }
  return or(
    ...[...byType].map(([kind, ids]) =>
      and(eq(type, kind as typeof cl.$inferSelect.sourceType), inArray(id, ids))
    )
  );
}

export class PostgresContentLinkRepository implements ContentLinkRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async insert(link: ContentLink): Promise<Result<ContentLink | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.insert(cl).values(linkToRow(link)).onConflictDoNothing().returning(),
      databaseUnavailable.during('insertContentLink')
    );
    return map(rows, ([row]) => (row ? linkFromRow(row) : null));
  }

  async findById(id: string): Promise<Result<ContentLink | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(cl).where(eq(cl.id, id)).limit(1),
      databaseUnavailable.during('findContentLink')
    );
    return map(rows, ([row]) => (row ? linkFromRow(row) : null));
  }

  async findByEdge(
    source: ContentRef,
    target: ContentRef,
    relation: ContentLinkRelation
  ): Promise<Result<ContentLink | null, DatabaseUnavailable>> {
    const from = toStoredRef(source);
    const to = toStoredRef(target);
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(cl)
          .where(
            and(
              eq(cl.sourceType, from.type),
              eq(cl.sourceId, from.id),
              eq(cl.targetType, to.type),
              eq(cl.targetId, to.id),
              eq(cl.relation, relation as typeof cl.$inferSelect.relation)
            )
          ),
      databaseUnavailable.during('findContentLinkByEdge')
    );
    return map(rows, (found) => {
      const key = `${contentRefKey(source)}>${contentRefKey(target)}`;
      const match = found
        .map(linkFromRow)
        .find((link) => `${contentRefKey(link.source)}>${contentRefKey(link.target)}` === key);
      return match ?? null;
    });
  }

  async transition(
    id: string,
    from: readonly ContentLinkStatus[],
    to: ContentLinkStatus,
    decidedBy: string | null
  ): Promise<Result<ContentLink | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(cl)
          .set({ status: to, decidedBy })
          .where(and(eq(cl.id, id), inArray(cl.status, [...from])))
          .returning(),
      databaseUnavailable.during('transitionContentLink')
    );
    return map(rows, ([row]) => (row ? linkFromRow(row) : null));
  }

  async remove(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.delete(cl).where(eq(cl.id, id)).returning({ id: cl.id }),
      databaseUnavailable.during('removeContentLink')
    );
    return map(rows, (removed) => removed.length > 0);
  }

  async touching(
    refs: readonly ContentRef[]
  ): Promise<Result<TouchingLink[], DatabaseUnavailable>> {
    if (refs.length === 0) return ok([]);
    const columns = getTableColumns(cl);
    const outgoing = this.db
      .select({ ...columns, direction: sql<string>`'outgoing'`.as('direction') })
      .from(cl)
      .where(and(eq(cl.status, 'active'), refsMatch(cl.sourceType, cl.sourceId, refs)));
    const incoming = this.db
      .select({ ...columns, direction: sql<string>`'incoming'`.as('direction') })
      .from(cl)
      .where(and(eq(cl.status, 'active'), refsMatch(cl.targetType, cl.targetId, refs)));
    const rows = await fromPromise(
      () => unionAll(outgoing, incoming),
      databaseUnavailable.during('touchingContentLinks')
    );
    const wanted = new Map(refs.map((ref) => [contentRefKey(ref), ref]));
    return map(rows, (found) => {
      const touching: TouchingLink[] = [];
      for (const { direction, ...row } of found.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )) {
        const link = linkFromRow(row);
        const ref = wanted.get(contentRefKey(direction === 'outgoing' ? link.source : link.target));
        if (ref)
          touching.push({
            direction: direction === 'outgoing' ? 'outgoing' : 'incoming',
            ref,
            link,
          });
      }
      return touching;
    });
  }

  async countOutgoing(source: ContentRef): Promise<Result<number, DatabaseUnavailable>> {
    const stored = toStoredRef(source);
    const rows = await fromPromise(
      () =>
        this.db
          .select({ total: count() })
          .from(cl)
          .where(
            and(
              eq(cl.sourceType, stored.type),
              eq(cl.sourceId, stored.id),
              inArray(cl.status, COUNTED)
            )
          ),
      databaseUnavailable.during('countOutgoingContentLinks')
    );
    return map(rows, ([row]) => row?.total ?? 0);
  }

  async countForChannel(channelId: string): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ total: count() })
          .from(cl)
          .where(and(eq(cl.sourceChannelId, channelId), inArray(cl.status, COUNTED))),
      databaseUnavailable.during('countChannelContentLinks')
    );
    return map(rows, ([row]) => row?.total ?? 0);
  }

  async chainEdges(
    channelId: string,
    relation: ContentLinkRelation
  ): Promise<Result<Map<string, string[]>, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(cl)
          .where(
            and(
              eq(cl.sourceChannelId, channelId),
              eq(cl.relation, relation as typeof cl.$inferSelect.relation),
              inArray(cl.status, COUNTED)
            )
          ),
      databaseUnavailable.during('contentLinkChainEdges')
    );
    return map(rows, (found) => {
      const edges = new Map<string, string[]>();
      for (const link of found.map(linkFromRow)) {
        const key = contentRefKey(link.source);
        edges.set(key, [...(edges.get(key) ?? []), contentRefKey(link.target)]);
      }
      return edges;
    });
  }

  async listByTargetChannel(
    channelId: string,
    statuses: readonly ContentLinkStatus[],
    limit: number
  ): Promise<Result<ContentLink[], DatabaseUnavailable>> {
    return this.listWhere(eq(cl.targetChannelId, channelId), statuses, limit);
  }

  async listBySourceChannel(
    channelId: string,
    statuses: readonly ContentLinkStatus[],
    limit: number
  ): Promise<Result<ContentLink[], DatabaseUnavailable>> {
    return this.listWhere(eq(cl.sourceChannelId, channelId), statuses, limit);
  }

  async markTargetBroken(target: ContentRef): Promise<Result<number, DatabaseUnavailable>> {
    const stored = toStoredRef(target);
    const rows = await fromPromise(
      () =>
        this.db
          .update(cl)
          .set({ status: 'broken' })
          .where(
            and(
              eq(cl.targetType, stored.type),
              eq(cl.targetId, stored.id),
              sql`${cl.status} <> 'broken'`
            )
          )
          .returning({ id: cl.id }),
      databaseUnavailable.during('markContentLinksBroken')
    );
    return map(rows, (marked) => marked.length);
  }

  async countSuggestedBy(
    viewerId: string,
    since: Date
  ): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ total: count() })
          .from(cl)
          .where(
            and(
              eq(cl.createdBy, viewerId),
              gte(cl.createdAt, since),
              inArray(cl.status, VIEWER_SUGGESTION_STATUSES)
            )
          ),
      databaseUnavailable.during('countViewerLinkSuggestions')
    );
    return map(rows, ([row]) => row?.total ?? 0);
  }

  async linkPolicy(channelId: string): Promise<Result<LinkPolicy, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ policy: settings.linkPolicy })
          .from(settings)
          .where(eq(settings.channelId, channelId))
          .limit(1),
      databaseUnavailable.during('readLinkPolicy')
    );
    return map(rows, ([row]) => row?.policy ?? DEFAULT_LINK_POLICY);
  }

  async setLinkPolicy(
    channelId: string,
    policy: LinkPolicy
  ): Promise<Result<void, DatabaseUnavailable>> {
    const written = await fromPromise(
      () =>
        this.db
          .insert(settings)
          .values({ channelId, linkPolicy: policy })
          .onConflictDoUpdate({
            target: settings.channelId,
            set: { linkPolicy: policy, updatedAt: sql`now()` },
          }),
      databaseUnavailable.during('writeLinkPolicy')
    );
    return map(written, () => undefined);
  }

  private async listWhere(
    scope: SQL,
    statuses: readonly ContentLinkStatus[],
    limit: number
  ): Promise<Result<ContentLink[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(cl)
          .where(and(scope, inArray(cl.status, [...statuses])))
          .orderBy(desc(cl.createdAt), desc(cl.id))
          .limit(limit),
      databaseUnavailable.during('listContentLinks')
    );
    return map(rows, (found) => found.map(linkFromRow));
  }
}
