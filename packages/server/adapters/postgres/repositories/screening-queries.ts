import type {
  ListScreeningCasesOptions,
  RaiseFlagInput,
  ScreeningCase,
  ScreeningCaseCursor,
  ScreeningRecord,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { FLAG_ONLY_CHECKSUM, type ScreeningDecision, mergeFlag } from '@vp/domain';
import { type SQL, and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { videoScreenings: vs, screeningAppeals: sa } = schema;

export type Tx = PostgresDatabase;

const hasFlags = sql`${vs.flags} <> '[]'::jsonb`;
const isCase = sql`(${vs.outcome} = 'HOLD' OR ${hasFlags})`;
const isOpen = sql<boolean>`((${vs.decision} IS NULL AND ${vs.outcome} = 'HOLD') OR (${hasFlags} AND ${vs.flagsClearedAt} IS NULL))`;

function caseScope(options: ListScreeningCasesOptions): SQL {
  const { cursor, state } = options;
  return and(
    isCase,
    state === 'open' ? isOpen : undefined,
    state === 'decided' ? sql`NOT ${isOpen}` : undefined,
    cursorScope(cursor)
  ) as SQL;
}

function cursorScope(cursor: ScreeningCaseCursor | null): SQL | undefined {
  if (!cursor) return undefined;
  const { open, createdAt, id } = cursor;
  return sql`(${isOpen}, ${vs.createdAt}, ${vs.id}) < (${open}::boolean, ${createdAt.toISOString()}::timestamptz, ${id}::uuid)`;
}

export async function latestOf(db: Tx, videoId: string): Promise<ScreeningRecord | undefined> {
  const [row] = await db
    .select()
    .from(vs)
    .where(eq(vs.videoId, videoId))
    .orderBy(desc(vs.createdAt), desc(vs.id))
    .limit(1);
  return row;
}

export async function decide(
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
      flagsClearedAt: new Date(),
    })
    .where(eq(vs.id, latest.id));
}

export async function resolveAppeal(tx: Tx, videoId: string, moderatorId: string): Promise<void> {
  await tx
    .update(sa)
    .set({ resolvedBy: moderatorId, resolvedAt: sql`now()` })
    .where(and(eq(sa.videoId, videoId), isNull(sa.resolvedAt)));
}

/** The newest result of the video takes the flag, or a passed one is started when it has none. */
export async function flagLatest(tx: Tx, input: RaiseFlagInput): Promise<boolean> {
  const { id, videoId, finding, thresholdVersion } = input;
  const latest = await latestOf(tx, videoId);
  if (!latest) {
    const created = await tx
      .insert(vs)
      .values({
        id,
        videoId,
        sourceChecksum: FLAG_ONLY_CHECKSUM,
        outcome: 'PASS',
        score: 0,
        reasons: [],
        flags: [finding],
        modelVersion: null,
        thresholdVersion,
      })
      .onConflictDoNothing()
      .returning({ id: vs.id });
    return created.length > 0;
  }

  const merged = mergeFlag(latest.flags, finding);
  if (!merged.changed) return false;

  await tx
    .update(vs)
    .set({
      flags: merged.flags,
      flagsClearedAt: null,
      ...(latest.decision === 'dismissed'
        ? { decision: null, decidedBy: null, decidedAt: null }
        : {}),
    })
    .where(eq(vs.id, latest.id));
  return true;
}

export async function selectCases(
  db: Tx,
  options: ListScreeningCasesOptions
): Promise<ScreeningCase[]> {
  const screenings = await db
    .select()
    .from(vs)
    .where(caseScope(options))
    .orderBy(desc(isOpen), desc(vs.createdAt), desc(vs.id))
    .limit(options.limit + 1);

  const videoIds = [...new Set(screenings.map((screening) => screening.videoId))];
  const appeals = videoIds.length
    ? await db.select().from(sa).where(inArray(sa.videoId, videoIds)).orderBy(desc(sa.createdAt))
    : [];

  return screenings.map((screening) => ({
    screening,
    appeal: appeals.find((appeal) => appeal.videoId === screening.videoId) ?? null,
  }));
}
