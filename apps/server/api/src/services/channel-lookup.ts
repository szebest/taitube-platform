import type { ChannelRepositoryPort } from '@vp/core/repositories';
import type { Channel } from '@vp/domain';
import { type ChannelNotFound, channelNotFound } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import { err, isErr, ok, type Result } from '@vp/result';

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
