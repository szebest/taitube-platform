import type { EditorPick } from '@vp/domain';
import { decidePickNoOverlap, validatePickWindow } from '@vp/domain-rules';
import { isErr } from '@vp/result';

import type { AdminPick } from '#app/features/admin/api/admin-picks';

const MS_PER_MINUTE = 60_000;

export type WindowIssue =
  | { kind: 'incomplete' }
  | { kind: 'invalid'; message: string }
  | { kind: 'overlap'; pick: AdminPick };

interface Window {
  startsAt: Date;
  endsAt: Date;
}

/** An ISO instant as a `datetime-local` input spells it, in the browser's own zone. */
export function toLocalInput(iso: string): string {
  const instant = new Date(iso);
  return new Date(instant.getTime() - instant.getTimezoneOffset() * MS_PER_MINUTE)
    .toISOString()
    .slice(0, 16);
}

/** The instant a `datetime-local` value names in the browser's zone; an empty or broken value names none. */
export function fromLocalInput(value: string): Date | undefined {
  const instant = new Date(value);
  return value === '' || Number.isNaN(instant.getTime()) ? undefined : instant;
}

const touches = (pick: AdminPick, window: Window) =>
  new Date(pick.startsAt).getTime() < window.endsAt.getTime() &&
  window.startsAt.getTime() < new Date(pick.endsAt).getTime();

const asEditorPick = (pick: AdminPick): EditorPick => ({
  ...pick,
  startsAt: new Date(pick.startsAt),
  endsAt: new Date(pick.endsAt),
  createdAt: new Date(pick.createdAt),
});

export interface WindowCheck {
  startsAt: string;
  endsAt: string;
  picks: readonly AdminPick[];
  /** The pick being edited, which may keep the window it already holds. */
  exceptId?: string;
  now: Date;
}

/** What the API would refuse about the window, found before the editor saves: the same two rules it runs. */
export function windowIssue({
  startsAt,
  endsAt,
  picks,
  exceptId,
  now,
}: WindowCheck): WindowIssue | undefined {
  const from = fromLocalInput(startsAt);
  const to = fromLocalInput(endsAt);
  if (!(from && to)) {
    return { kind: 'incomplete' };
  }

  const window = { startsAt: from, endsAt: to };
  const valid = validatePickWindow(window, now);
  if (isErr(valid)) {
    return { kind: 'invalid', message: valid.error.message };
  }

  const holder = picks.find((pick) => pick.id !== exceptId && touches(pick, window));
  const decided = decidePickNoOverlap(window, holder ? asEditorPick(holder) : null);
  return holder && isErr(decided) ? { kind: 'overlap', pick: holder } : undefined;
}

/** The first window a new pick offers: tomorrow, midnight to midnight, in the browser's zone. */
export function defaultWindow(now: Date): { startsAt: string; endsAt: string } {
  const day = (offset: number) =>
    toLocalInput(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset).toISOString());

  return { startsAt: day(1), endsAt: day(2) };
}
