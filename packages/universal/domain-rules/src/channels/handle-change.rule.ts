import { HANDLE_CHANGE_COOLDOWN_DAYS } from '@vp/domain';
import { MS_PER_DAY } from '@vp/domain/time';
import { type Result, err, ok } from '@vp/result';
import { type HandleChangeTooSoon, handleChangeTooSoon } from './failures';

export interface DecideHandleChangeInput {
  readonly currentHandle: string;
  readonly nextHandle: string;
  readonly handleChangedAt: Date | null;
  readonly now: Date;
}

/** Whether the handle may change now: saving the handle the channel already has changes nothing and is always fine. */
export function decideHandleChange({
  currentHandle,
  nextHandle,
  handleChangedAt,
  now,
}: DecideHandleChangeInput): Result<{ changes: boolean }, HandleChangeTooSoon> {
  if (nextHandle.toLowerCase() === currentHandle.toLowerCase()) return ok({ changes: false });
  if (handleChangedAt === null) return ok({ changes: true });

  const availableAt = new Date(
    handleChangedAt.getTime() + HANDLE_CHANGE_COOLDOWN_DAYS * MS_PER_DAY
  );
  return availableAt > now ? err(handleChangeTooSoon(availableAt)) : ok({ changes: true });
}
