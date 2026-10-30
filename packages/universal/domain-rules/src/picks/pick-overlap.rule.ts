import type { EditorPick } from '@vp/domain';
import { type Result, err, ok } from '@vp/result';
import { type PickWindowOverlap, pickWindowOverlap } from './failures';
import type { PickWindow } from './pick-window.rule';

/** The pick holding part of the window is a repository read, so the rule stays pure. */
export function decidePickNoOverlap(
  window: PickWindow,
  overlapping: EditorPick | null
): Result<PickWindow, PickWindowOverlap> {
  return overlapping ? err(pickWindowOverlap(window.startsAt, window.endsAt)) : ok(window);
}
