import type { UpdatePickBody } from '@vp/api-contracts';
import { isErr } from '@vp/result';
import { validatePickNote } from '@vp/validation';

import type { AdminPick } from '#app/features/admin/api/admin-picks';
import type { PickVideo } from '#app/features/admin/api/pick-videos';
import { toLocalInput, type WindowIssue, windowIssue } from './pick-schedule';

export interface PickDraft {
  video: PickVideo | null;
  startsAt: string;
  endsAt: string;
  note: string;
}

export interface DraftIssues {
  video: boolean;
  window: WindowIssue | undefined;
  note: boolean;
}

export interface DraftContext {
  picks: readonly AdminPick[];
  exceptId?: string;
  now: Date;
}

/** Everything the API would refuse about the draft, found in the browser by the rules it runs. */
export function draftIssues(
  { video, startsAt, endsAt, note }: PickDraft,
  { picks, exceptId, now }: DraftContext
): DraftIssues {
  return {
    video: video === null,
    window: windowIssue({ startsAt, endsAt, picks, exceptId, now }),
    note: isErr(validatePickNote(note)),
  };
}

export const hasIssues = ({ video, window, note }: DraftIssues) =>
  video || note || window !== undefined;

export interface PickInstants {
  videoId: string;
  startsAt: Date;
  endsAt: Date;
  note: string | null;
}

const sameMinute = (instant: Date, iso: string) =>
  toLocalInput(instant.toISOString()) === toLocalInput(iso);

/** The PATCH body for what the editor changed on `pick`; none when nothing changed. A window is compared as the input shows it, to the minute. */
export function changesOf(pick: AdminPick, next: PickInstants): UpdatePickBody | undefined {
  const changes: UpdatePickBody = {
    ...(next.videoId !== pick.videoId && { videoId: next.videoId }),
    ...(!sameMinute(next.startsAt, pick.startsAt) && {
      startsAt: next.startsAt.toISOString(),
    }),
    ...(!sameMinute(next.endsAt, pick.endsAt) && {
      endsAt: next.endsAt.toISOString(),
    }),
    ...(next.note !== pick.note && { note: next.note }),
  };
  return Object.keys(changes).length === 0 ? undefined : changes;
}
