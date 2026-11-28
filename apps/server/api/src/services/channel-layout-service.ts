import type { InvalidCursor, Paginator } from '@kit/pagination';
import { type Result, andThen, err, isErr, ok } from '@kit/result';
import type {
  ChannelPageDraftView,
  ChannelPagePublishedView,
  ChannelPageRevisionPageView,
} from '@vp/api-contracts';
import type {
  ChannelImageRepositoryPort,
  ChannelLayoutRepositoryPort,
  ChannelPageSourceRepositoryPort,
  EntityRevisionRepository,
  PublishedChannelLayout,
} from '@vp/core/repositories';
import {
  type ActingChannel,
  type ChannelLayout,
  ENTITY_REVISION_KEEP,
  standardChannelLayout,
} from '@vp/domain';
import {
  type AuthorizationFailure,
  type LayoutDocumentFailure,
  type LayoutRevisionNotFound,
  decideChannelTask,
  decideLayoutDocument,
  layoutRevisionNotFound,
} from '@vp/domain-rules';
import { type DatabaseUnavailable, type VersionConflict, versionConflict } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { pageAudit } from './channel-layout-audit';
import { type LayoutCheckFailure, checkLayout } from './channel-layout-checks';
import { readStoredLayout } from './channel-layout-document';
import { isoOf } from './cursor';
import { decodeRevisionCursor, revisionCursorPayload } from './revision-cursor';

export interface ChannelLayoutServiceDeps {
  layouts: ChannelLayoutRepositoryPort;
  revisions: Pick<EntityRevisionRepository, 'list' | 'get'>;
  sources: Pick<ChannelPageSourceRepositoryPort, 'hydrate'>;
  images: Pick<ChannelImageRepositoryPort, 'findReadyImages'>;
  paginator: Paginator;
}

type Failure = AuthorizationFailure | DatabaseUnavailable;
export type SaveLayoutFailure = Failure | LayoutDocumentFailure | VersionConflict;
export type PublishLayoutFailure = Failure | LayoutCheckFailure | VersionConflict;
export type RestoreLayoutFailure = Failure | LayoutRevisionNotFound;

function publishedView(layout: PublishedChannelLayout): ChannelPagePublishedView {
  const { version, note, authorUserId, restoredFromVersion, createdAt } = layout;
  return { version, note, authorUserId, restoredFromVersion, createdAt: isoOf(createdAt) };
}

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
      standardChannelLayout();
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
      audit: pageAudit(user, acting, {
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
    const checked = await checkLayout(this.deps, acting, document);
    if (isErr(checked)) return checked;

    const published = await this.deps.layouts.publish({
      channelId: acting.channelId,
      document: checked.value,
      authorUserId: user.id,
      note: body.note ?? null,
      restoredFromVersion: null,
      audit: (version) => pageAudit(user, acting, { action: 'page.published', meta: { version } }),
    });
    return andThen(published, (layout) => ok(publishedView(layout)));
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
        pageAudit(user, acting, { action: 'page.restored', meta: { version, fromVersion } }),
    });
    return andThen(published, (layout) => ok(publishedView(layout)));
  }
}
