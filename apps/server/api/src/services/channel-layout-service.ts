import type { Paginator } from '@kit/pagination';
import type { InvalidCursor } from '@kit/pagination';
import { type Result, andThen, err, isErr, map, ok } from '@kit/result';
import type {
  ChannelPageDraftView,
  ChannelPagePublishedView,
  ChannelPageRevisionPageView,
  ChannelPageScheduleView,
} from '@vp/api-contracts';
import type {
  ChannelLayoutRepositoryPort,
  ChannelLayoutScheduleRepositoryPort,
  ChannelPageSourceRepositoryPort,
  EntityRevisionRepository,
  PublishedChannelLayout,
} from '@vp/core/repositories';
import {
  type ActingChannel,
  type ChannelLayout,
  ENTITY_REVISION_KEEP,
  type NewChannelAuditEntry,
  defaultChannelLayout,
} from '@vp/domain';
import {
  type AuthorizationFailure,
  type LayoutDocumentFailure,
  type LayoutReferenceInvalid,
  type LayoutRevisionNotFound,
  type LayoutScheduleInvalid,
  type LayoutScheduleNotFound,
  decideChannelTask,
  decideLayoutDocument,
  decideLayoutReferences,
  decideLayoutSchedule,
  layoutReferences,
  layoutRevisionNotFound,
  layoutScheduleNotFound,
} from '@vp/domain-rules';
import { type DatabaseUnavailable, type VersionConflict, versionConflict } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { auditActor } from './audit-actor';
import { readStoredLayout } from './channel-layout-document';
import { isoOf } from './cursor';
import { decodeRevisionCursor, revisionCursorPayload } from './revision-cursor';

export interface ChannelLayoutServiceDeps {
  layouts: ChannelLayoutRepositoryPort;
  schedules: ChannelLayoutScheduleRepositoryPort;
  revisions: Pick<EntityRevisionRepository, 'list' | 'get'>;
  sources: Pick<ChannelPageSourceRepositoryPort, 'hydrate'>;
  paginator: Paginator;
  now: () => number;
}

type PageEvent =
  Extract<NewChannelAuditEntry, { targetType: 'page' }> extends infer Entry
    ? Entry extends { action: infer Action; meta: infer Meta }
      ? { action: Action; meta: Meta }
      : never
    : never;

type Failure = AuthorizationFailure | DatabaseUnavailable;
export type SaveLayoutFailure = Failure | LayoutDocumentFailure | VersionConflict;
export type PublishLayoutFailure = SaveLayoutFailure | LayoutReferenceInvalid;
export type ScheduleLayoutFailure =
  | PublishLayoutFailure
  | LayoutScheduleInvalid
  | LayoutRevisionNotFound;
export type RestoreLayoutFailure = Failure | LayoutRevisionNotFound;

function publishedView(layout: PublishedChannelLayout): ChannelPagePublishedView {
  const { version, note, authorUserId, restoredFromVersion, createdAt } = layout;
  return { version, note, authorUserId, restoredFromVersion, createdAt: isoOf(createdAt) };
}

/** The draft, the published history and the schedules of the acting channel page. */
export class ChannelLayoutService {
  constructor(private readonly deps: ChannelLayoutServiceDeps) {}

  async getDraft(
    user: UserContext,
    acting: ActingChannel
  ): Promise<Result<ChannelPageDraftView, Failure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-page' });
    if (isErr(allowed)) return allowed;
    const { layouts } = this.deps;
    const draft = await layouts.getDraft(acting.channelId);
    if (isErr(draft)) return draft;
    const published = await layouts.getPublished(acting.channelId);
    if (isErr(published)) return published;

    const document =
      readStoredLayout(draft.value?.document) ??
      readStoredLayout(published.value?.document) ??
      defaultChannelLayout();
    return ok({
      document,
      version: draft.value?.version ?? 0,
      publishedRevision: published.value?.version ?? null,
      updatedBy: draft.value?.updatedBy ?? null,
      updatedAt: draft.value ? isoOf(draft.value.updatedAt) : null,
    });
  }

  async saveDraft(
    user: UserContext,
    acting: ActingChannel,
    body: { document: ChannelLayout; version: number }
  ): Promise<Result<ChannelPageDraftView, SaveLayoutFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-page' });
    if (isErr(allowed)) return allowed;
    const { layouts } = this.deps;
    const published = await layouts.getPublished(acting.channelId);
    if (isErr(published)) return published;
    const decided = decideLayoutDocument(
      body.document,
      readStoredLayout(published.value?.document)
    );
    if (isErr(decided)) return decided;

    const saved = await layouts.saveDraft({
      channelId: acting.channelId,
      document: body.document,
      expectedVersion: body.version,
      userId: user.id,
      audit: this.audit(user, acting, {
        action: 'page.draft_saved',
        meta: { version: body.version + 1 },
      }),
    });
    if (isErr(saved)) return saved;
    if (saved.value.type === 'stale') return err(versionConflict(acting.channelId, body.version));
    const { draft } = saved.value;
    return ok({
      document: body.document,
      version: draft.version,
      publishedRevision: published.value?.version ?? null,
      updatedBy: draft.updatedBy,
      updatedAt: isoOf(draft.updatedAt),
    });
  }

  async publish(
    user: UserContext,
    acting: ActingChannel,
    body: { version: number; note?: string | null }
  ): Promise<Result<ChannelPagePublishedView, PublishLayoutFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-page' });
    if (isErr(allowed)) return allowed;
    const draft = await this.deps.layouts.getDraft(acting.channelId);
    if (isErr(draft)) return draft;
    const document = readStoredLayout(draft.value?.document);
    if (!draft.value || draft.value.version !== body.version || !document) {
      return err(versionConflict(acting.channelId, body.version));
    }
    const checked = await this.checked(acting, document);
    if (isErr(checked)) return checked;

    const published = await this.deps.layouts.publish({
      channelId: acting.channelId,
      document: checked.value,
      authorUserId: user.id,
      note: body.note ?? null,
      restoredFromVersion: null,
      audit: (version) => this.audit(user, acting, { action: 'page.published', meta: { version } }),
    });
    return andThen(published, (layout) => ok(publishedView(layout)));
  }

  async listSchedules(
    user: UserContext,
    acting: ActingChannel
  ): Promise<Result<{ items: ChannelPageScheduleView[] }, Failure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-page' });
    if (isErr(allowed)) return allowed;
    const rows = await this.deps.schedules.listPending(acting.channelId);
    return andThen(rows, (found) =>
      ok({
        items: found.map(({ id, publishAt, status, createdAt }) =>
          scheduleView(id, publishAt, status, createdAt)
        ),
      })
    );
  }

  async schedule(
    user: UserContext,
    acting: ActingChannel,
    body: { publishAt: Date; source: 'draft' | 'published' }
  ): Promise<Result<ChannelPageScheduleView, ScheduleLayoutFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-page' });
    if (isErr(allowed)) return allowed;
    const at = decideLayoutSchedule({ publishAt: body.publishAt, now: new Date(this.deps.now()) });
    if (isErr(at)) return at;

    const stored = await this.storedDocument(acting.channelId, body.source);
    if (isErr(stored)) return stored;
    const document = readStoredLayout(stored.value);
    if (!document) return err(layoutRevisionNotFound(acting.channelId, body.source));
    const checked = await this.checked(acting, document);
    if (isErr(checked)) return checked;

    const id = uuidv7();
    const created = await this.deps.schedules.create(
      {
        id,
        channelId: acting.channelId,
        document: checked.value,
        publishAt: at.value,
        createdBy: user.id,
      },
      this.audit(user, acting, {
        action: 'page.scheduled',
        meta: { scheduleId: id, publishAt: at.value.toISOString() },
      })
    );
    return andThen(created, ({ publishAt, status, createdAt }) =>
      ok(scheduleView(id, publishAt, status, createdAt))
    );
  }

  async cancelSchedule(
    user: UserContext,
    acting: ActingChannel,
    scheduleId: string
  ): Promise<Result<ChannelPageScheduleView, Failure | LayoutScheduleNotFound>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-page' });
    if (isErr(allowed)) return allowed;
    const pending = await this.deps.schedules.listPending(acting.channelId);
    if (isErr(pending)) return pending;
    const target = pending.value.find(({ id }) => id === scheduleId);
    if (!target) return err(layoutScheduleNotFound(scheduleId));

    const cancelled = await this.deps.schedules.cancel(
      acting.channelId,
      scheduleId,
      this.audit(user, acting, {
        action: 'page.schedule_cancelled',
        meta: { scheduleId, publishAt: target.publishAt.toISOString() },
      })
    );
    return andThen(cancelled, (row) =>
      row
        ? ok(scheduleView(row.id, row.publishAt, row.status, row.createdAt))
        : err(layoutScheduleNotFound(scheduleId))
    );
  }

  async listRevisions(
    user: UserContext,
    acting: ActingChannel,
    query: { cursor?: string; limit?: number }
  ): Promise<Result<ChannelPageRevisionPageView, Failure | InvalidCursor>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-page' });
    if (isErr(allowed)) return allowed;
    const { paginator, revisions } = this.deps;
    const limit = paginator.limit(query.limit ?? ENTITY_REVISION_KEEP);
    const cursor = decodeRevisionCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await revisions.list('channel_layout', acting.channelId, {
      beforeVersion: cursor.value,
      limit,
    });
    return andThen(rows, (found) =>
      ok(
        paginator.paginate(found, limit, {
          cursorOf: revisionCursorPayload,
          toItem: ({ id, version, snapshot, authorUserId, restoredFromVersion, createdAt }) => ({
            id,
            version,
            note: snapshot.note,
            authorUserId,
            restoredFromVersion,
            createdAt: isoOf(createdAt),
          }),
        })
      )
    );
  }

  async restore(
    user: UserContext,
    acting: ActingChannel,
    revisionId: string
  ): Promise<Result<ChannelPagePublishedView, RestoreLayoutFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-page' });
    if (isErr(allowed)) return allowed;
    const found = await this.deps.revisions.get('channel_layout', acting.channelId, revisionId);
    if (isErr(found)) return found;
    const document = readStoredLayout(found.value?.snapshot.document);
    if (!found.value || !document) return err(layoutRevisionNotFound(acting.channelId, revisionId));

    const fromVersion = found.value.version;
    const published = await this.deps.layouts.publish({
      channelId: acting.channelId,
      document,
      authorUserId: user.id,
      note: found.value.snapshot.note,
      restoredFromVersion: fromVersion,
      audit: (version) =>
        this.audit(user, acting, { action: 'page.restored', meta: { version, fromVersion } }),
    });
    return andThen(published, (layout) => ok(publishedView(layout)));
  }

  private async storedDocument(
    channelId: string,
    source: 'draft' | 'published'
  ): Promise<Result<unknown, DatabaseUnavailable>> {
    const { layouts } = this.deps;
    return source === 'draft'
      ? map(await layouts.getDraft(channelId), (draft) => draft?.document)
      : map(await layouts.getPublished(channelId), (published) => published?.document);
  }

  private async checked(
    acting: ActingChannel,
    document: ChannelLayout
  ): Promise<
    Result<ChannelLayout, LayoutDocumentFailure | LayoutReferenceInvalid | DatabaseUnavailable>
  > {
    const live = await this.deps.layouts.getPublished(acting.channelId);
    if (isErr(live)) return live;
    const decided = decideLayoutDocument(document, readStoredLayout(live.value?.document));
    if (isErr(decided)) return decided;
    const hydrated = await this.deps.sources.hydrate(layoutReferences(decided.value));
    if (isErr(hydrated)) return hydrated;
    return decideLayoutReferences(decided.value, {
      channelId: acting.channelId,
      ownerUserId: acting.ownerId,
      facts: hydrated.value.flatMap(({ kind, id, channelId, ownerUserId }) =>
        kind === 'live' ? [] : [{ kind, id, channelId, ownerUserId }]
      ),
    });
  }

  private audit(
    user: UserContext,
    acting: ActingChannel,
    event: PageEvent
  ): Extract<NewChannelAuditEntry, { targetType: 'page' }> {
    return {
      channelId: acting.channelId,
      ...auditActor(user),
      targetType: 'page',
      targetId: acting.channelId,
      ...event,
    };
  }
}

function scheduleView(
  id: string,
  publishAt: Date,
  status: ChannelPageScheduleView['status'],
  createdAt: Date
): ChannelPageScheduleView {
  return { id, publishAt: publishAt.toISOString(), status, createdAt: createdAt.toISOString() };
}
