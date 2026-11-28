import { all, isErr, isOk, map, ok, type Result, unwrapOr } from '@kit/result';
import type {
  ChannelAuditRepositoryPort,
  ChannelMemberRepositoryPort,
  ChannelRepositoryPort,
  NotificationRepositoryPort,
} from '@vp/core/repositories';
import type { ChannelAuditAction, ContentLink, NotificationKind } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { auditActor } from './audit-actor';

export interface ContentLinkNotifierDeps {
  channels: Pick<ChannelRepositoryPort, 'findById'>;
  members: Pick<ChannelMemberRepositoryPort, 'listByChannel'>;
  notifications: Pick<NotificationRepositoryPort, 'record'>;
  audit: Pick<ChannelAuditRepositoryPort, 'append'>;
}

type LinkAuditAction = Extract<ChannelAuditAction, `link.${string}`>;

const dayOf = (at: Date) => at.toISOString().slice(0, 10);

/** The notifications and the audit row every link change writes. */
export class ContentLinkNotifier {
  constructor(private readonly deps: ContentLinkNotifierDeps) {}

  async audit(
    user: UserContext,
    action: Exclude<LinkAuditAction, 'link.policy_changed'>,
    channelId: string,
    link: ContentLink
  ): Promise<Result<void, DatabaseUnavailable>> {
    const appended = await this.deps.audit.append({
      ...auditActor(user),
      channelId,
      action,
      targetType: 'link',
      targetId: link.id,
      meta: { relation: link.params.relation, status: link.status },
    });
    return map(appended, () => undefined);
  }

  async auditPolicy(
    user: UserContext,
    channelId: string,
    policy: 'allow' | 'approve' | 'block'
  ): Promise<Result<void, DatabaseUnavailable>> {
    const appended = await this.deps.audit.append({
      ...auditActor(user),
      channelId,
      action: 'link.policy_changed',
      targetType: 'settings',
      targetId: channelId,
      meta: { policy },
    });
    return map(appended, () => undefined);
  }

  /** The owner and the managers of a channel, except `except`. */
  async managersOf(
    channelId: string,
    except: string
  ): Promise<Result<string[], DatabaseUnavailable>> {
    const [channel, members] = await Promise.all([
      this.deps.channels.findById(channelId),
      this.deps.members.listByChannel(channelId),
    ]);
    if (isErr(channel)) return channel;
    if (isErr(members)) return members;
    const ids = new Set(
      members.value.filter(({ role }) => role === 'manager').map(({ userId }) => userId)
    );
    if (channel.value) ids.add(channel.value.userId);
    ids.delete(except);
    return ok([...ids]);
  }

  async ownerOf(channelId: string): Promise<string | null> {
    const channel = await this.deps.channels.findById(channelId);
    return isOk(channel) ? (channel.value?.userId ?? null) : null;
  }

  async tell(
    kind: NotificationKind,
    userIds: readonly string[],
    link: ContentLink,
    actorChannelId: string,
    options: { decision?: 'approved' | 'declined'; at: Date }
  ): Promise<Result<void, DatabaseUnavailable>> {
    if (userIds.length === 0) return ok();
    const actor = unwrapOr(await this.deps.channels.findById(actorChannelId), null);
    const grouped =
      kind === 'link_suggestion'
        ? `link_suggestion:${link.sourceChannelId}:${dayOf(options.at)}`
        : null;
    const recorded = await Promise.all(
      userIds.map((userId) =>
        this.deps.notifications.record({
          userId,
          kind,
          actorChannelId: kind === 'link_suggestion' ? null : actorChannelId,
          videoId: null,
          commentId: null,
          groupKey: grouped,
          payload: {
            actor:
              kind === 'link_suggestion' || !actor
                ? null
                : {
                    handle: actor.handle,
                    displayName: actor.displayName,
                    avatarUrl: actor.avatarUrl,
                  },
            videoTitle: null,
            excerpt: null,
            outcome: null,
            link: {
              id: link.id,
              relation: link.params.relation,
              source: link.source,
              target: link.target,
              decision: options.decision ?? null,
            },
          },
        })
      )
    );
    return map(all(recorded), () => undefined);
  }
}
