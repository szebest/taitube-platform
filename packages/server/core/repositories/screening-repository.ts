import type {
  ScreeningAppeal,
  ScreeningFinding,
  ScreeningOutcome,
  VideoScreening,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { NewOutboxInput } from './outbox-repository';

export type ScreeningRecord = VideoScreening;
export type ScreeningAppealRecord = ScreeningAppeal;

export interface NewScreeningInput {
  id: string;
  videoId: string;
  sourceChecksum: string;
  outcome: ScreeningOutcome;
  score: number;
  reasons: ScreeningFinding[];
  flags: ScreeningFinding[];
  modelVersion: string | null;
  thresholdVersion: string;
}

export interface HoldVideoInput {
  videoId: string;
  traceId?: string | null;
}

export interface ApproveHeldVideoInput {
  videoId: string;
  moderatorId: string;
  /** The `package` job that writes the master, enqueued in the same transaction as the approval. */
  outbox?: NewOutboxInput;
}

export interface RejectHeldVideoInput {
  videoId: string;
  moderatorId: string;
  reason: string;
}

export interface AppealRejectionInput {
  id: string;
  videoId: string;
  authorId: string;
  message: string;
}

export interface DismissFlagsInput {
  videoId: string;
  moderatorId: string;
}

/**
 * The state `HELD` and its four edges. Each edge is a compare-and-set on the video's status that
 * appends its `video_events` row in the same transaction, and answers `false` when the video was
 * not in the status the edge starts from, or is gone: a stale actor writes nothing.
 */
export abstract class ScreeningRepository {
  /** Idempotent on the video and its source checksum: a re-run gets the stored result back. */
  abstract record(input: NewScreeningInput): Promise<Result<ScreeningRecord, DatabaseUnavailable>>;
  abstract findByVideo(
    videoId: string,
    sourceChecksum: string
  ): Promise<Result<ScreeningRecord | null, DatabaseUnavailable>>;
  /** The newest result of the video whatever its source, for the moderator and the creator views. */
  abstract latestForVideo(
    videoId: string
  ): Promise<Result<ScreeningRecord | null, DatabaseUnavailable>>;
  abstract findAppeals(
    videoId: string
  ): Promise<Result<ScreeningAppealRecord[], DatabaseUnavailable>>;

  /** `PROCESSING` to `HELD`. */
  abstract hold(input: HoldVideoInput): Promise<Result<boolean, DatabaseUnavailable>>;
  /** `HELD` to `PROCESSING`, recording who approved; an open appeal on the video is resolved. */
  abstract approve(input: ApproveHeldVideoInput): Promise<Result<boolean, DatabaseUnavailable>>;
  /** `HELD` to `REJECTED` with the screening rejection marker, recording who and why. */
  abstract reject(input: RejectHeldVideoInput): Promise<Result<boolean, DatabaseUnavailable>>;
  /** `REJECTED` to `HELD`, only for a screening rejection, and opens the appeal row. */
  abstract appeal(input: AppealRejectionInput): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Closes a flag without a state change; `false` when the newest result is decided or has no flags. */
  abstract dismiss(input: DismissFlagsInput): Promise<Result<boolean, DatabaseUnavailable>>;
}
