import {
  type AppealRejectionInput,
  type ApproveHeldVideoInput,
  type DismissFlagsInput,
  type HoldVideoInput,
  type NewScreeningInput,
  type RejectHeldVideoInput,
  type ScreeningAppealRecord,
  type ScreeningRecord,
  ScreeningRepository,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { SCREENING_TRANSITIONS, type ScreeningDecision } from '@vp/domain';
import { type DatabaseUnavailable, ErrorCodes, databaseUnavailable } from '@vp/errors';
import { type Result, fromPromise, map } from '@vp/result';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';
import { commitVideoTransition } from './video-transition';

const { videoScreenings: vs, screeningAppeals: sa, videos: v, videoEvents: ve } = schema;

type Tx = PostgresDatabase;

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
          if (!screening || screening.outcome !== 'PASS' || screening.flags.length === 0) {
            return false;
          }

          const dismissed = await tx
            .update(vs)
            .set({ decision: 'dismissed', decidedBy: moderatorId, decidedAt: new Date() })
            .where(and(eq(vs.id, screening.id), isNull(vs.decision)))
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
}

async function latestOf(db: Tx, videoId: string): Promise<ScreeningRecord | undefined> {
  const [row] = await db
    .select()
    .from(vs)
    .where(eq(vs.videoId, videoId))
    .orderBy(desc(vs.createdAt), desc(vs.id))
    .limit(1);
  return row;
}

async function decide(
  tx: Tx,
  videoId: string,
  decision: {
    decision: Extract<ScreeningDecision, 'approved' | 'rejected'>;
    moderatorId: string;
    note?: string;
  }
): Promise<void> {
  const latest = await latestOf(tx, videoId);
  if (!latest) return;

  await tx
    .update(vs)
    .set({
      decision: decision.decision,
      decidedBy: decision.moderatorId,
      decidedAt: new Date(),
      decisionNote: decision.note ?? null,
    })
    .where(eq(vs.id, latest.id));
}

async function resolveAppeal(tx: Tx, videoId: string, moderatorId: string): Promise<void> {
  await tx
    .update(sa)
    .set({ resolvedBy: moderatorId, resolvedAt: sql`now()` })
    .where(and(eq(sa.videoId, videoId), isNull(sa.resolvedAt)));
}
