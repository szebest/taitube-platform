import { type DatabaseUnavailable } from '@kit/errors';
import { type Result, err, isErr, map, ok } from '@kit/result';
import type { CreateChannelBody, IdentitiesView, OwnedChannelView } from '@vp/api-contracts';
import type {
  ChannelHandleHistoryRepositoryPort,
  ChannelMemberRepositoryPort,
  ChannelRepositoryPort,
  UserRepository,
} from '@vp/core/repositories';
import {
  type Channel,
  type ChannelAuditAction,
  type NewChannelAuditEntry,
  toChannelCard,
} from '@vp/domain';
import {
  type ChannelNotFound,
  type ChannelNotOwned,
  type ClaimHandleFailure,
  channelNotOwned,
  decideCreateChannel,
  decidePromote,
} from '@vp/domain-rules';
import { type ChannelLimitReached, ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';

export interface MyChannelsServiceDeps {
  users: Pick<UserRepository, 'findById'>;
  channels: Pick<
    ChannelRepositoryPort,
    'listByUserId' | 'findById' | 'findByIds' | 'findByHandle' | 'createOwned' | 'promote'
  >;
  handleHistory: Pick<ChannelHandleHistoryRepositoryPort, 'findByHandle'>;
  members: Pick<ChannelMemberRepositoryPort, 'membershipsOf'>;
  maxOwned: number;
  now: () => number;
}

export type CreateChannelFailure = ClaimHandleFailure | ChannelLimitReached | DatabaseUnavailable;
export type PromoteChannelFailure = ChannelNotFound | ChannelNotOwned | DatabaseUnavailable;

type AccountNotFound = { readonly code: 'UNAUTHORIZED'; readonly message: string };

function auditOf(
  user: UserContext,
  channelId: string,
  action: Extract<ChannelAuditAction, 'channel.created' | 'channel.promoted'>
): NewChannelAuditEntry {
  return {
    channelId,
    actorUserId: user.id,
    action,
    targetType: 'channel',
    targetId: channelId,
    meta: {},
  };
}

function ownedView(channel: Channel): OwnedChannelView {
  return { ...toChannelCard(channel), isPrimary: channel.isPrimary };
}

/** The channels an account owns and the identities it can act as; one owner, several channels. */
export class MyChannelsService {
  constructor(private readonly deps: MyChannelsServiceDeps) {}

  async create(
    user: UserContext,
    body: CreateChannelBody
  ): Promise<Result<OwnedChannelView, CreateChannelFailure>> {
    const { channels, handleHistory, maxOwned } = this.deps;
    const owned = await channels.listByUserId(user.id);
    if (isErr(owned)) return owned;
    const heldBy = await channels.findByHandle(body.handle);
    if (isErr(heldBy)) return heldBy;
    const retired = await handleHistory.findByHandle(body.handle);
    if (isErr(retired)) return retired;

    const handle = decideCreateChannel({
      handle: body.handle,
      heldBy: heldBy.value,
      retirement: { retired: retired.value, now: new Date(this.deps.now()) },
      owned: owned.value.length,
      limit: maxOwned,
    });
    if (isErr(handle)) return handle;

    const id = uuidv7();
    const created = await channels.createOwned(
      { id, userId: user.id, handle: handle.value, displayName: body.displayName },
      maxOwned,
      auditOf(user, id, 'channel.created')
    );
    return map(created, ownedView);
  }

  async promote(
    user: UserContext,
    channelId: string
  ): Promise<Result<OwnedChannelView, PromoteChannelFailure>> {
    const found = await this.deps.channels.findById(channelId);
    if (isErr(found)) return found;
    const decided = decidePromote({ user, channelId, channel: found.value });
    if (isErr(decided)) return decided;

    const promoted = await this.deps.channels.promote(
      user.id,
      channelId,
      auditOf(user, channelId, 'channel.promoted')
    );
    if (isErr(promoted)) return promoted;
    return promoted.value ? ok(ownedView(promoted.value)) : err(channelNotOwned(channelId));
  }

  async identities(
    user: UserContext
  ): Promise<Result<IdentitiesView, AccountNotFound | DatabaseUnavailable>> {
    const { users, channels, members } = this.deps;
    const account = await users.findById(user.id);
    if (isErr(account)) return account;
    if (!account.value) {
      return err({ code: ErrorCodes.UNAUTHORIZED, message: 'User record not found' });
    }
    const owned = await channels.listByUserId(user.id);
    if (isErr(owned)) return owned;
    const held = await members.membershipsOf(user.id);
    if (isErr(held)) return held;
    const memberChannels = await channels.findByIds(held.value.map(({ channelId }) => channelId));
    if (isErr(memberChannels)) return memberChannels;

    const byId = new Map(memberChannels.value.map((channel) => [channel.id, channel]));
    return ok({
      account: { id: account.value.id, email: account.value.email },
      owned: owned.value.map(ownedView),
      member: held.value.flatMap(({ channelId, ownerId, role }) => {
        const channel = byId.get(channelId);
        return channel ? [{ ...toChannelCard(channel), role, ownerId }] : [];
      }),
    });
  }
}
