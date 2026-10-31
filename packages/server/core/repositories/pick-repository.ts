import type { EditorPick, EditorPickEntry } from '@vp/domain';
import type { DatabaseUnavailable, PickWindowOverlap } from '@vp/errors';
import type { Result } from '@vp/result';

export interface PickRange {
  from: Date;
  to: Date;
}

export type PickWriteFailure = DatabaseUnavailable | PickWindowOverlap;

/**
 * Windows are half-open, `[startsAt, endsAt)`: one that starts where another ends does not overlap
 * it. The store enforces that even when two writes race, and reports it as `PickWindowOverlap`.
 */
export interface PickRepositoryPort {
  create(pick: EditorPick): Promise<Result<void, PickWriteFailure>>;
  /** Replaces the stored pick of the same id. `false` when there is none. */
  update(pick: EditorPick): Promise<Result<boolean, PickWriteFailure>>;
  findById(id: string): Promise<Result<EditorPick | null, DatabaseUnavailable>>;
  /** The pick holding part of the window, leaving out `exceptId`, which an edit passes for itself. */
  findOverlapping(
    window: { startsAt: Date; endsAt: Date },
    exceptId?: string
  ): Promise<Result<EditorPick | null, DatabaseUnavailable>>;
  /** The pick whose window holds `at`, with its video whatever the video's state. */
  findCurrent(at: Date): Promise<Result<EditorPickEntry | null, DatabaseUnavailable>>;
  /** Every pick whose window touches the range, earliest first, with its video. */
  listBetween(range: PickRange): Promise<Result<EditorPickEntry[], DatabaseUnavailable>>;
  remove(id: string): Promise<Result<boolean, DatabaseUnavailable>>;
}
