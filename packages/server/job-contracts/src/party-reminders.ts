import { z } from 'zod';
import { notificationOutbox } from './notifications';

export const NOTIFY_PARTY_REMINDER = 'notify-party-reminder';

/** `before` goes out ten minutes ahead of the party, `start` at its time. */
const PARTY_REMINDER_LEADS = ['before', 'start'] as const;
const PARTY_REMINDER_LEAD_MS = { before: 10 * 60_000, start: 0 } as const;

export const NotifyPartyReminderJob = z.object({
  roomId: z.uuid(),
  /** The instant the room was scheduled for when this job was enqueued; a job that no longer matches the room does nothing. */
  scheduledFor: z.iso.datetime(),
  lead: z.enum(PARTY_REMINDER_LEADS),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type NotifyPartyReminderJob = z.infer<typeof NotifyPartyReminderJob>;

/**
 * The reminders of a scheduled room still ahead of `now`: ten minutes before and at the start. The
 * job id carries the instant, so a reschedule enqueues new ones and the old ones find the room moved.
 */
export function partyReminderOutboxes(roomId: string, scheduledFor: Date, now: Date) {
  return PARTY_REMINDER_LEADS.flatMap((lead) => {
    const delay = scheduledFor.getTime() - PARTY_REMINDER_LEAD_MS[lead] - now.getTime();
    return delay <= 0
      ? []
      : [
          notificationOutbox({
            name: NOTIFY_PARTY_REMINDER,
            data: { roomId, scheduledFor: scheduledFor.toISOString(), lead },
            jobId: `${roomId}--${NOTIFY_PARTY_REMINDER}--${scheduledFor.getTime()}--${lead}`,
            delay,
          }),
        ];
  });
}
