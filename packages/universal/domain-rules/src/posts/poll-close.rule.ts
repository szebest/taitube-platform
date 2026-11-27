import { MS_PER_DAY } from '@kit/primitives';
import { type Result, err, ok } from '@kit/result';
import { POLL_MAX_OPEN_DAYS, type PostPayload } from '@vp/domain';
import { type InvalidPostPayload, invalidPostCloseTime } from '@vp/validation';
import { pollOf } from './poll';

/**
 * A close time is an instant after the poll opens and within the poll window of it; a poll without
 * one stays open. `opensAt` is the moment voting starts: now, or the publish time of a scheduled post.
 * An edit that leaves the close time as it was is not asked again, so a closed poll stays editable.
 */
export function decidePollClose(
  payload: PostPayload,
  opensAt: Date,
  previous: PostPayload | null = null
): Result<void, InvalidPostPayload> {
  const closesAt = pollOf(payload)?.closesAt ?? null;
  if (closesAt === null || closesAt === (previous && pollOf(previous)?.closesAt))
    return ok(undefined);
  const at = new Date(closesAt).getTime();
  const from = opensAt.getTime();
  const within = at > from && at <= from + POLL_MAX_OPEN_DAYS * MS_PER_DAY;
  return within ? ok(undefined) : err(invalidPostCloseTime(POLL_MAX_OPEN_DAYS));
}
