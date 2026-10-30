import {
  type CaptionCommit,
  type CaptionRecord,
  CaptionRepository,
  type CaptionSettings,
  type CompleteGeneratedTrack,
  type EditCueText,
  type FailGeneratedTrack,
  type NewGeneratedTrack,
  type RegenerateTrack,
  type UploadTrack,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { SEARCH_TEXT_CONFIG, transcriptVector } from '@vp/db';
import { captionsFailed, captionsReady, type TranscriptCue } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { and, asc, eq, lt, ne, type SQL, sql } from 'drizzle-orm';
import { bumped, lockTrack, record, replaceCues, settingsOf } from './caption-writes';
import type { PostgresDatabase } from './types';

const { videoCaptions: vc, videoTranscriptCues: cue, videos, channels } = schema;

const stale: CaptionCommit = { type: 'stale' };

function committed(track: CaptionRecord): CaptionCommit {
  return { type: 'committed', track };
}

export class PostgresCaptionRepository extends CaptionRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  private read<T>(name: string, query: () => Promise<T>): Promise<Result<T, DatabaseUnavailable>> {
    return fromPromise(query, databaseUnavailable.during(name));
  }

  private commit(
    name: string,
    write: (tx: PostgresDatabase) => Promise<CaptionCommit>
  ): Promise<Result<CaptionCommit, DatabaseUnavailable>> {
    return this.read(name, () => this.db.transaction(write));
  }

  async settings(videoId: string): Promise<Result<CaptionSettings | null, DatabaseUnavailable>> {
    return this.read('captionSettings', () => settingsOf(this.db, videoId));
  }

  async setAutoCaptions(
    videoId: string,
    autoCaptions: boolean | null
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await this.read('setAutoCaptions', () =>
      this.db
        .update(videos)
        .set({ autoCaptions })
        .where(eq(videos.id, videoId))
        .returning({ id: videos.id })
    );
    return map(rows, (updated) => updated.length > 0);
  }

  async setChannelDefault(
    ownerId: string,
    enabled: boolean
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await this.read('setChannelDefault', () =>
      this.db
        .update(channels)
        .set({ autoCaptionsDefault: enabled })
        .where(eq(channels.userId, ownerId))
        .returning({ id: channels.id })
    );
    return map(rows, (updated) => updated.length > 0);
  }

  list(videoId: string): Promise<Result<CaptionRecord[], DatabaseUnavailable>> {
    return this.read('listCaptions', () =>
      this.db
        .select()
        .from(vc)
        .where(eq(vc.videoId, videoId))
        .orderBy(asc(vc.createdAt), asc(vc.id))
    );
  }

  private async one(name: string, where: SQL | undefined) {
    const rows = await this.read(name, () => this.db.select().from(vc).where(where));
    return map(rows, ([row]): CaptionRecord | null => row ?? null);
  }

  findById(id: string): Promise<Result<CaptionRecord | null, DatabaseUnavailable>> {
    return this.one('findCaption', eq(vc.id, id));
  }

  findGenerated(videoId: string): Promise<Result<CaptionRecord | null, DatabaseUnavailable>> {
    return this.one('findGeneratedCaption', and(eq(vc.videoId, videoId), ne(vc.kind, 'uploaded')));
  }

  findByLanguage(
    videoId: string,
    language: string
  ): Promise<Result<CaptionRecord | null, DatabaseUnavailable>> {
    return this.one(
      'findCaptionByLanguage',
      and(eq(vc.videoId, videoId), eq(vc.language, language))
    );
  }

  createGenerated(track: NewGeneratedTrack): Promise<Result<CaptionRecord, DatabaseUnavailable>> {
    return this.read('createGeneratedCaption', () =>
      this.db.transaction(async (tx) => {
        await tx
          .insert(vc)
          .values({ ...track, kind: 'auto' })
          .onConflictDoNothing({ target: vc.videoId, where: sql`${vc.kind} <> 'uploaded'` });
        const [row] = await tx
          .select()
          .from(vc)
          .where(and(eq(vc.videoId, track.videoId), ne(vc.kind, 'uploaded')));
        if (!row) throw new Error(`generated caption of ${track.videoId} was not stored`);
        return row;
      })
    );
  }

  complete(input: CompleteGeneratedTrack): Promise<Result<CaptionCommit, DatabaseUnavailable>> {
    return this.commit('completeCaption', async (tx) => {
      const current = await lockTrack(tx, input.id, input.expectedVersion);
      if (!current) return stale;

      const [taken] = await tx
        .select({ id: vc.id })
        .from(vc)
        .where(
          and(eq(vc.videoId, current.videoId), eq(vc.language, input.language), ne(vc.id, input.id))
        );
      if (taken) return { type: 'language-taken' };

      const [track] = await tx
        .update(vc)
        .set(
          bumped({
            status: 'ready',
            language: input.language,
            detectedLanguage: input.detectedLanguage,
            reason: null,
          })
        )
        .where(eq(vc.id, input.id))
        .returning();
      if (!track) return stale;
      await replaceCues(tx, track.id, input.cues);
      await record(
        tx,
        'captions.ready',
        track,
        captionsReady(track.videoId, { id: track.id, language: input.language, kind: track.kind })
      );
      return committed(track);
    });
  }

  fail(input: FailGeneratedTrack): Promise<Result<CaptionCommit, DatabaseUnavailable>> {
    return this.commit('failCaption', async (tx) => {
      if (!(await lockTrack(tx, input.id, input.expectedVersion))) return stale;

      const [track] = await tx
        .update(vc)
        .set(bumped({ status: input.status, reason: input.reason }))
        .where(eq(vc.id, input.id))
        .returning();
      if (!track) return stale;
      await record(
        tx,
        `captions.${input.status}`,
        track,
        input.status === 'failed'
          ? captionsFailed(track.videoId, track.id, input.reason)
          : undefined
      );
      return committed(track);
    });
  }

  regenerate(input: RegenerateTrack): Promise<Result<CaptionCommit, DatabaseUnavailable>> {
    return this.commit('regenerateCaption', async (tx) => {
      if (!(await lockTrack(tx, input.id, input.expectedVersion))) return stale;

      const [track] = await tx
        .update(vc)
        .set(
          bumped({
            kind: 'auto',
            status: 'pending',
            language: input.language,
            detectedLanguage: null,
            modelVersion: input.modelVersion,
            reason: null,
          })
        )
        .where(eq(vc.id, input.id))
        .returning();
      if (!track) return stale;
      await record(tx, 'captions.requested', track);
      return committed(track);
    });
  }

  upload(input: UploadTrack): Promise<Result<CaptionCommit, DatabaseUnavailable>> {
    return this.commit('uploadCaption', async (tx) => {
      const [existing] = await tx
        .select({ id: vc.id })
        .from(vc)
        .where(and(eq(vc.videoId, input.videoId), eq(vc.language, input.language)))
        .for('update');

      const uploaded = {
        kind: 'uploaded',
        status: 'ready',
        detectedLanguage: null,
        modelVersion: null,
        reason: null,
      } as const;
      const [track] = existing
        ? await tx.update(vc).set(bumped(uploaded)).where(eq(vc.id, existing.id)).returning()
        : await tx
            .insert(vc)
            .values({ id: input.id, videoId: input.videoId, language: input.language, ...uploaded })
            .returning();
      if (!track) return stale;
      await replaceCues(tx, track.id, input.cues);
      await record(
        tx,
        'captions.uploaded',
        track,
        captionsReady(track.videoId, { id: track.id, language: input.language, kind: 'uploaded' })
      );
      return committed(track);
    });
  }

  editCues(input: EditCueText): Promise<Result<CaptionCommit, DatabaseUnavailable>> {
    return this.commit('editCaptionCues', async (tx) => {
      const current = await lockTrack(tx, input.id, input.expectedVersion);
      if (!current) return stale;

      for (const { index, text } of input.cues) {
        await tx
          .update(cue)
          .set({ text })
          .where(and(eq(cue.captionId, input.id), eq(cue.cueIndex, index)));
      }
      const [track] = await tx
        .update(vc)
        .set(bumped({ kind: current.kind === 'auto' ? 'edited' : current.kind }))
        .where(eq(vc.id, input.id))
        .returning();
      if (!track) return stale;
      await record(tx, 'captions.edited', track);
      return committed(track);
    });
  }

  async delete(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await this.read('deleteCaption', () =>
      this.db.delete(vc).where(eq(vc.id, id)).returning({ id: vc.id })
    );
    return map(rows, (deleted) => deleted.length > 0);
  }

  cues(captionId: string, query?: string): Promise<Result<TranscriptCue[], DatabaseUnavailable>> {
    const matches = query
      ? sql`${transcriptVector} @@ websearch_to_tsquery(${SEARCH_TEXT_CONFIG}::regconfig, ${query})`
      : undefined;
    return this.read('captionCues', () =>
      this.db
        .select({
          index: cue.cueIndex,
          startMs: cue.startMs,
          endMs: cue.endMs,
          text: cue.text,
        })
        .from(cue)
        .where(and(eq(cue.captionId, captionId), matches))
        .orderBy(asc(cue.cueIndex))
    );
  }

  listStalePending(
    olderThanMs: number,
    limit: number
  ): Promise<Result<CaptionRecord[], DatabaseUnavailable>> {
    const cutoff = new Date(Date.now() - olderThanMs);
    return this.read('listStalePendingCaptions', () =>
      this.db
        .select()
        .from(vc)
        .where(and(eq(vc.status, 'pending'), ne(vc.kind, 'uploaded'), lt(vc.updatedAt, cutoff)))
        .orderBy(asc(vc.updatedAt))
        .limit(limit)
    );
  }
}
