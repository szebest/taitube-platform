import type { NewOutboxInput } from '@vp/core/repositories';
import type { WatchPartyRoom } from '@vp/domain';
import { partyReminderOutboxes } from '@vp/job-contracts';

/** A reschedule is the only edit that enqueues: reminders for the new instant, none for an unchanged one. */
export function remindersFor(
  room: WatchPartyRoom,
  scheduledFor: Date | null | undefined,
  now: Date
): NewOutboxInput[] {
  if (!scheduledFor || scheduledFor.getTime() === room.scheduledFor?.getTime()) return [];
  return partyReminderOutboxes(room.id, scheduledFor, now);
}
