import { frameBands } from '@vp/domain';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { drizzle } from 'drizzle-orm/pglite';
import { migratedPglite } from '../../../../__tests__/contract/pglite-snapshot';
import { PostgresFingerprintRepository } from '../../postgres-fingerprint-repository';

const FRAMES_PER_VIDEO = 150;
const QUERY_FRAMES = 150;
const AUDIO_TERMS_PER_VIDEO = 200;
const LIMITS = { minBandSetBits: 2, minTermSetBits: 4, maxHitsPerKey: 200 };

export const LOOKUP_BUDGET_MS = 200;

export interface LookupMeasurement {
  frameMs: number;
  audioMs: number;
  candidateFrames: number;
}

/**
 * The lookup for a new upload against a catalogue of `videos` fingerprinted videos, timed by Postgres itself
 * (`EXPLAIN ANALYZE`, the median of three runs after a warm-up, as a catalogue in use is cached), on PGlite, which is Postgres compiled to WebAssembly and
 * slower than a server. Every row draws its own random hash, the best case for the band index; real footage
 * clusters, so the numbers bound nothing from above. The load runs without foreign-key triggers, and the primary
 * keys and secondary indexes are built after it, which is several times faster than keeping them up to date row by row.
 */
export async function measureCatalogueLookup(videos: number): Promise<LookupMeasurement> {
  const pglite = await migratedPglite();
  const repository = new PostgresFingerprintRepository(drizzle(pglite) as never);
  await pglite.exec(`
    INSERT INTO users (id, email) VALUES ('${SEEDED.userId}', 'perf@example.com');
    INSERT INTO videos (id, owner_id, source_key)
      SELECT gen_random_uuid(), '${SEEDED.userId}', 'raw/' || n FROM generate_series(1, ${videos}) n;
  `);
  const secondary = await pglite.query<{ indexname: string; indexdef: string }>(
    `SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename IN ('video_frame_hashes', 'video_audio_fingerprints') AND indexname NOT LIKE '%_pk'`
  );
  for (const { indexname } of secondary.rows) await pglite.exec(`DROP INDEX ${indexname}`);
  await pglite.exec(`
    SET session_replication_role = replica;
    ALTER TABLE video_frame_hashes DROP CONSTRAINT video_frame_hashes_video_id_idx_pk;
    ALTER TABLE video_audio_fingerprints DROP CONSTRAINT video_audio_fingerprints_video_id_idx_pk;
  `);
  await pglite.exec(`
    ALTER TABLE video_frame_hashes SET UNLOGGED;
    ALTER TABLE video_audio_fingerprints SET UNLOGGED;
    INSERT INTO video_frame_hashes (video_id, idx, hash, b0, b1, b2, b3)
      SELECT id, idx, hash,
        (hash & 65535)::int, ((hash >> 16) & 65535)::int, ((hash >> 32) & 65535)::int, ((hash >> 48) & 65535)::int
      FROM (
        SELECT v.id, i AS idx, ((random() * 9.2e18)::bigint # (random() * 4e9)::bigint) AS hash
        FROM videos v, generate_series(0, ${FRAMES_PER_VIDEO - 1}) i
      ) frames;
    INSERT INTO video_audio_fingerprints (video_id, idx, term)
      SELECT v.id, i, ((random() * 4e9)::bigint - 2147483648)::int FROM videos v, generate_series(0, ${AUDIO_TERMS_PER_VIDEO - 1}) i;
  `);
  await pglite.exec(`
    ALTER TABLE video_frame_hashes ADD PRIMARY KEY (video_id, idx);
    ALTER TABLE video_audio_fingerprints ADD PRIMARY KEY (video_id, idx);
    SET session_replication_role = origin;
  `);
  for (const { indexdef } of secondary.rows) await pglite.exec(indexdef);
  await pglite.exec('ANALYZE');

  const hashes = Array.from(
    { length: QUERY_FRAMES * 2 },
    () => BigInt(Math.floor(Math.random() * 2 ** 53)) << 8n
  );
  const bands = hashes.map(frameBands);
  const list = (position: number) => [...new Set(bands.map((band) => band[position]))].join(',');
  const terms = Array.from(
    { length: AUDIO_TERMS_PER_VIDEO * 4 },
    () => Math.floor(Math.random() * 2 ** 32) - 2 ** 31
  );
  const executeOnce = async (query: string): Promise<number> => {
    const plan = await pglite.query<{ 'QUERY PLAN': { 'Execution Time': number }[] }>(
      `EXPLAIN (ANALYZE, FORMAT JSON) ${query}`
    );
    return plan.rows[0]?.['QUERY PLAN'][0]?.['Execution Time'] ?? Number.POSITIVE_INFINITY;
  };
  const executionMs = async (query: string): Promise<number> => {
    await executeOnce(query);
    const runs = [await executeOnce(query), await executeOnce(query), await executeOnce(query)];
    return runs.sort((a, b) => a - b)[1] ?? Number.POSITIVE_INFINITY;
  };

  const frameMs = await executionMs(`
    SELECT video_id, idx, hash FROM video_frame_hashes
    WHERE video_id <> '00000000-0000-7000-8000-0000000000ff'
      AND (b0 IN (${list(0)}) OR b1 IN (${list(1)}) OR b2 IN (${list(2)}) OR b3 IN (${list(3)}))`);
  const audioMs = await executionMs(`
    SELECT video_id, idx, term FROM video_audio_fingerprints
    WHERE video_id <> '00000000-0000-7000-8000-0000000000ff' AND term IN (${terms.join(',')})`);
  const frames = expectOk(
    await repository.findFramesSharingBand(hashes, '00000000-0000-7000-8000-0000000000ff', LIMITS)
  );
  await pglite.close();
  return { frameMs, audioMs, candidateFrames: frames.length };
}
