import type {
  ChannelRepositoryPort,
  PlaylistRepositoryPort,
  UserRepository,
} from '@vp/core/repositories';
import type { Channel } from '@vp/domain';
import { type ChannelNotFound, channelNotFound } from '@vp/domain-rules';
import { type DatabaseUnavailable, ErrorCodes, type HandleTaken } from '@vp/errors';
import { err, isErr, ok, type Result } from '@vp/result';
import { handleCandidates } from '@vp/validation';
import { uuidv7 } from 'uuidv7';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function findChannelByIdOrHandle(
  channels: Pick<ChannelRepositoryPort, 'findById' | 'findByHandle'>,
  idOrHandle: string
): Promise<Result<Channel, ChannelNotFound | DatabaseUnavailable>> {
  if (UUID_REGEX.test(idOrHandle)) {
    const byId = await channels.findById(idOrHandle);
    if (isErr(byId)) return byId;
    if (byId.value) return ok(byId.value);
  }

  const byHandle = await channels.findByHandle(idOrHandle.replace(/^@/, ''));
  if (isErr(byHandle)) return byHandle;

  return byHandle.value ? ok(byHandle.value) : err(channelNotFound(idOrHandle));
}

export type ProvisionFailure = DatabaseUnavailable | HandleTaken;

/** The first handle derived from the email, then the id, that no channel holds. */
async function claimFreeHandle(
  channels: Pick<ChannelRepositoryPort, 'findByHandle'>,
  email: string,
  userId: string
): Promise<Result<string, ProvisionFailure>> {
  for (const candidate of handleCandidates(email, userId)) {
    const heldBy = await channels.findByHandle(candidate);
    if (isErr(heldBy)) return heldBy;
    if (!heldBy.value) return ok(candidate);
  }

  return err({
    code: ErrorCodes.HANDLE_ALREADY_TAKEN,
    message: `Could not derive a free handle for user ${userId}`,
    handle: '',
  });
}

/**
 * Every write tolerates losing a race with a concurrent request for the same identity - and only
 * that, so a dead store still surfaces instead of a half-provisioned user.
 */
export async function provisionAccount(
  deps: {
    users: UserRepository;
    channels: ChannelRepositoryPort;
    playlists: Pick<PlaylistRepositoryPort, 'provisionWatchLater'>;
  },
  userId: string,
  email?: string
): Promise<Result<Channel, ProvisionFailure>> {
  const userEmail = email || `${userId}@taitube.local`;

  const existingUser = await deps.users.findById(userId);
  if (isErr(existingUser)) return existingUser;

  if (!existingUser.value) {
    const upserted = await deps.users.upsert({ id: userId, email: userEmail, tier: 'free' });
    if (isErr(upserted)) return upserted;
  }

  const existingChannel = await deps.channels.findByUserId(userId);
  if (isErr(existingChannel)) return existingChannel;
  if (existingChannel.value) return ok(existingChannel.value);

  // The channel is the "already provisioned" marker, so Watch Later has to exist before it does.
  const watchLater = await deps.playlists.provisionWatchLater({ id: uuidv7(), ownerId: userId });
  if (isErr(watchLater)) return watchLater;

  const handle = await claimFreeHandle(deps.channels, userEmail, userId);
  if (isErr(handle)) return handle;

  const created = await deps.channels.create({
    userId,
    handle: handle.value,
    displayName: email ? email.split('@')[0] || 'User' : 'User',
  });
  if (!isErr(created) || created.error.code !== ErrorCodes.HANDLE_ALREADY_TAKEN) return created;

  // A concurrent request for the same identity got there first; its channel is ours.
  const raced = await deps.channels.findByUserId(userId);
  if (isErr(raced)) return raced;
  return raced.value ? ok(raced.value) : created;
}
