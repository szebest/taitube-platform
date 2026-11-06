import type { ChannelRepositoryPort } from '@vp/core/repositories';
import type { Channel } from '@vp/domain';
import { type ChannelNotFound, channelNotFound } from '@vp/domain-rules';
import { type DatabaseUnavailable, ErrorCodes, type HandleTaken } from '@vp/errors';
import { err, isErr, ok, type Result } from '@vp/result';
import { handleCandidates } from '@vp/validation';

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
export async function claimFreeHandle(
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
