import { MS_PER_DAY } from '@kit/primitives';
import { type Result, err, ok } from '@kit/result';
import { POLL_MAX_OPEN_DAYS, type PostPayload } from '@vp/domain';
import { type InvalidPostPayload, invalidPostCloseTime } from '@vp/validation';
import { pollOf } from './poll';

/** A close time is a future instant within the poll window; a poll without one stays open. */
export function decidePollClose(payload: PostPayload, now: Date): Result<void, InvalidPostPayload> {
  const closesAt = pollOf(payload)?.closesAt ?? null;
  if (closesAt === null) return ok(undefined);
  const at = new Date(closesAt).getTime();
  const within = at > now.getTime() && at <= now.getTime() + POLL_MAX_OPEN_DAYS * MS_PER_DAY;
  return within ? ok(undefined) : err(invalidPostCloseTime(POLL_MAX_OPEN_DAYS));
}
