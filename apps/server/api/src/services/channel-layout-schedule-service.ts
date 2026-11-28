import { type Result, andThen, err, isErr, map, ok } from '@kit/result';
import type { ChannelPageScheduleView } from '@vp/api-contracts';
import type {
  ChannelLayoutRepositoryPort,
  ChannelLayoutScheduleRepositoryPort,
  ChannelLayoutSchedule,
} from '@vp/core/repositories';
import type { ActingChannel } from '@vp/domain';
import {
  type AuthorizationFailure,
  type LayoutRevisionNotFound,
  type LayoutScheduleInvalid,
  type LayoutScheduleNotFound,
  decideChannelTask,
  decideLayoutSchedule,
  layoutRevisionNotFound,
  layoutScheduleNotFound,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { pageAudit } from './channel-layout-audit';
import {
  type LayoutCheckDeps,
  type LayoutCheckFailure,
  checkLayout,
} from './channel-layout-checks';
import { readStoredLayout } from './channel-layout-document';

export interface ChannelLayoutScheduleServiceDeps extends LayoutCheckDeps {
  layouts: Pick<ChannelLayoutRepositoryPort, 'getDraft' | 'getPublished'>;
  schedules: ChannelLayoutScheduleRepositoryPort;
  now: () => number;
}

type Failure = AuthorizationFailure | DatabaseUnavailable;
export type ScheduleLayoutFailure =
  | Failure
  | LayoutCheckFailure
  | LayoutScheduleInvalid
  | LayoutRevisionNotFound;

function viewOf({
  id,
  publishAt,
  status,
  createdAt,
}: ChannelLayoutSchedule): ChannelPageScheduleView {
  return { id, publishAt: publishAt.toISOString(), status, createdAt: createdAt.toISOString() };
}

export class ChannelLayoutScheduleService {
  constructor(private readonly deps: ChannelLayoutScheduleServiceDeps) {}

  async list(
    user: UserContext,
    acting: ActingChannel
  ): Promise<Result<{ items: ChannelPageScheduleView[] }, Failure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-page' });
    if (isErr(allowed)) return allowed;
    const rows = await this.deps.schedules.listPending(acting.channelId);
    return map(rows, (found) => ({ items: found.map(viewOf) }));
  }

  async create(
    user: UserContext,
    acting: ActingChannel,
    body: { publishAt: Date; source: 'draft' | 'published' }
  ): Promise<Result<ChannelPageScheduleView, ScheduleLayoutFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-page' });
    if (isErr(allowed)) return allowed;
    const at = decideLayoutSchedule({ publishAt: body.publishAt, now: new Date(this.deps.now()) });
    if (isErr(at)) return at;

    const stored = await this.stored(acting.channelId, body.source);
    if (isErr(stored)) return stored;
    const document = readStoredLayout(stored.value);
    if (!document) return err(layoutRevisionNotFound(acting.channelId, body.source));
    const checked = await checkLayout(this.deps, acting, document);
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
      pageAudit(user, acting, {
        action: 'page.scheduled',
        meta: { scheduleId: id, publishAt: at.value.toISOString() },
      })
    );
    return map(created, viewOf);
  }

  async cancel(
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
      pageAudit(user, acting, {
        action: 'page.schedule_cancelled',
        meta: { scheduleId, publishAt: target.publishAt.toISOString() },
      })
    );
    return andThen(cancelled, (row) =>
      row ? ok(viewOf(row)) : err(layoutScheduleNotFound(scheduleId))
    );
  }

  private async stored(
    channelId: string,
    source: 'draft' | 'published'
  ): Promise<Result<unknown, DatabaseUnavailable>> {
    const { layouts } = this.deps;
    return source === 'draft'
      ? map(await layouts.getDraft(channelId), (draft) => draft?.document)
      : map(await layouts.getPublished(channelId), (published) => published?.document);
  }
}
