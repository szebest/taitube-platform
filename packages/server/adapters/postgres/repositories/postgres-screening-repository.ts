import {
  type AppealRejectionInput,
  type ApproveHeldVideoInput,
  type DismissFlagsInput,
  type HoldVideoInput,
  type ListScreeningCasesOptions,
  type NewScreeningInput,
  type PurgeableEvidenceOptions,
  type RaiseFlagInput,
  type RejectHeldVideoInput,
  type ScreeningAppealRecord,
  type ScreeningCase,
  type ScreeningRecord,
  ScreeningRepository,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { FLAG_ONLY_CHECKSUM, SCREENING_TRANSITIONS, mergeFlag } from '@vp/domain';
import { type DatabaseUnavailable, ErrorCodes, databaseUnavailable } from '@vp/errors';
import { type Result, fromPromise, map } from '@vp/result';
import { and, desc, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { decide, flagLatest, latestOf, resolveAppeal, selectCases } from './screening-queries';
import type { PostgresDatabase } from './types';
import { commitVideoTransition } from './video-transition';

const { videoScreenings: vs, screeningAppeals: sa, videos: v, videoEvents: ve } = schema;

export class PostgresScreeningRepository extends ScreeningRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async record(input: NewScreeningInput): Promise<Result<ScreeningRecord, DatabaseUnavailable>> {
    return fromPromise(async () => {
      const [created] = await this.db.insert(vs).values(input).onConflictDoNothing().returning();
      if (created) return created;

      const [stored] = await this.db
        .select()
        .from(vs)
        .where(and(eq(vs.videoId, input.videoId), eq(vs.sourceChecksum, input.sourceChecksum)));
      if (!stored) throw new Error('video_screenings conflict left no row');
      return stored;
    }, databaseUnavailable.during('record'));
  }

  async findByVideo(
    videoId: string,
    sourceChecksum: string
  ): Promise<Result<ScreeningRecord | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(vs)
          .where(and(eq(vs.videoId, videoId), eq(vs.sourceChecksum, sourceChecksum))),
      databaseUnavailable.during('findByVideo')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async latestForVideo(
    videoId: string
  ): Promise<Result<ScreeningRecord | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => latestOf(this.db, videoId),
      databaseUnavailable.during('latestForVideo')
    );
    return map(rows, (row) => row ?? null);
  }

  async findAppeals(
    videoId: string
  ): Promise<Result<ScreeningAppealRecord[], DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.select().from(sa).where(eq(sa.videoId, videoId)).orderBy(desc(sa.createdAt)),
      databaseUnavailable.during('findAppeals')
    );
  }

  async hold(input: HoldVideoInput): Promise<Result<boolean, DatabaseUnavailable>> {
    const { videoId, traceId } = input;
    const edge = SCREENING_TRANSITIONS.hold;

    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const screening = await latestOf(tx, videoId);
          return commitVideoTransition(tx, {
            videoId,
            from: edge.from,
            to: edge.to,
            eventType: edge.event,
            eventPayload: {
              screeningId: screening?.id ?? null,
              reasons: screening?.reasons.map((finding) => finding.reason) ?? [],
            },
            traceId,
          });
        }),
      databaseUnavailable.during('hold')
    );
  }

  async approve(input: ApproveHeldVideoInput): Promise<Result<boolean, DatabaseUnavailable>> {
    const { videoId, moderatorId, outbox } = input;
    const edge = SCREENING_TRANSITIONS.approve;

    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const moved = await commitVideoTransition(tx, {
            videoId,
            from: edge.from,
            to: edge.to,
            eventType: edge.event,
            eventPayload: { moderatorId },
            outbox,
          });
          if (!moved) return false;

          await decide(tx, videoId, { decision: 'approved', moderatorId });
          await resolveAppeal(tx, videoId, moderatorId);
          return true;
        }),
      databaseUnavailable.during('approve')
    );
  }

  async reject(input: RejectHeldVideoInput): Promise<Result<boolean, DatabaseUnavailable>> {
    const { videoId, moderatorId, reason } = input;
    const edge = SCREENING_TRANSITIONS.reject;

    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const moved = await commitVideoTransition(tx, {
            videoId,
            from: edge.from,
            to: edge.to,
            eventType: edge.event,
            eventPayload: { moderatorId, reason },
            patch: { errorCode: ErrorCodes.SCREENING_REJECTED },
          });
          if (!moved) return false;

          await decide(tx, videoId, { decision: 'rejected', moderatorId, note: reason });
          await resolveAppeal(tx, videoId, moderatorId);
          return true;
        }),
      databaseUnavailable.during('reject')
    );
  }

  async appeal(input: AppealRejectionInput): Promise<Result<boolean, DatabaseUnavailable>> {
    const { id, videoId, authorId, message } = input;
    const edge = SCREENING_TRANSITIONS.appeal;

    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [locked] = await tx
            .select({ errorCode: v.errorCode })
            .from(v)
            .where(eq(v.id, videoId))
            .for('update');
          const screening = await latestOf(tx, videoId);
          if (locked?.errorCode !== ErrorCodes.SCREENING_REJECTED || !screening) return false;

          const moved = await commitVideoTransition(tx, {
            videoId,
            from: edge.from,
            to: edge.to,
            eventType: edge.event,
            eventPayload: { appealId: id, authorId },
            patch: { errorCode: null },
          });
          if (!moved) return false;

          await tx.insert(sa).values({
            id,
            videoId,
            screeningId: screening.id,
            authorId,
            message,
            rejectedBy: screening.decidedBy,
          });
          await tx
            .update(vs)
            .set({ decision: null, decidedBy: null, decidedAt: null, decisionNote: null })
            .where(eq(vs.id, screening.id));
          return true;
        }),
      databaseUnavailable.during('appeal')
    );
  }

  async dismiss(input: DismissFlagsInput): Promise<Result<boolean, DatabaseUnavailable>> {
    const { videoId, moderatorId } = input;

    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const screening = await latestOf(tx, videoId);
          if (
            !screening ||
            screening.flags.length === 0 ||
            screening.flagsClearedAt !== null ||
            (screening.outcome === 'HOLD' && screening.decision === null)
          ) {
            return false;
          }

          const now = new Date();
          const dismissed = await tx
            .update(vs)
            .set({
              flagsClearedAt: now,
              ...(screening.decision === null
                ? { decision: 'dismissed', decidedBy: moderatorId, decidedAt: now }
                : {}),
            })
            .where(and(eq(vs.id, screening.id), isNull(vs.flagsClearedAt)))
            .returning({ id: vs.id });
          if (dismissed.length === 0) return false;

          await tx.insert(ve).values({
            videoId,
            type: 'video.screening_dismissed',
            payload: { moderatorId, screeningId: screening.id },
          });
          return true;
        }),
      databaseUnavailable.during('dismiss')
    );
  }

  async raiseFlag(input: RaiseFlagInput): Promise<Result<boolean, DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.transaction((tx) => flagLatest(tx, input)),
      databaseUnavailable.during('raiseFlag')
    );
  }

  async listCases(
    options: ListScreeningCasesOptions
  ): Promise<Result<ScreeningCase[], DatabaseUnavailable>> {
    return fromPromise(
      () => selectCases(this.db, options),
      databaseUnavailable.during('listCases')
    );
  }

  async findPurgeableEvidence(
    options: PurgeableEvidenceOptions
  ): Promise<Result<ScreeningRecord[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(vs)
          .where(
            and(
              isNotNull(vs.decision),
              isNull(vs.evidencePurgedAt),
              lt(vs.decidedAt, options.closedBefore)
            )
          )
          .orderBy(vs.decidedAt)
          .limit(options.limit),
      databaseUnavailable.during('findPurgeableEvidence')
    );
  }

  async markEvidencePurged(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(vs)
          .set({ evidencePurgedAt: new Date() })
          .where(and(eq(vs.id, id), isNull(vs.evidencePurgedAt)))
          .returning({ id: vs.id }),
      databaseUnavailable.during('markEvidencePurged')
    );
    return map(rows, (updated) => updated.length > 0);
  }
}
