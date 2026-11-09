import { frameBands } from '@vp/domain';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { drizzle } from 'drizzle-orm/pglite';
import { migratedPglite } from '../../../../__tests__/contract/pglite-snapshot';
import { PostgresFingerprintRepository } from '../../postgres-fingerprint-repository';

const VIDEOS = 10_000;
const FRAMES_PER_VIDEO = 150;
const QUERY_FRAMES = 150;
const AUDIO_TERMS_PER_VIDEO = 400;
const BUDGET_MS = 200;

/**
 * The lookup for a new upload against a catalogue of 10 000 fingerprinted videos of five minutes each,
 * timed by Postgres itself (`EXPLAIN ANALYZE`), on PGlite, which is Postgres compiled to WebAssembly and slower than a server. Uniformly random hashes
 * are the best case for the band index; real footage clusters, so the numbers bound nothing from above.
 * Run by hand: `pnpm --filter @vp/adapters test:integration`.
 */
describe('PostgresFingerprintRepository: lookup against a catalogue of 10 000 videos', () => {
  it('answers the frame and audio lookups of a new video within the budget', async () => {
    const pglite = await migratedPglite();
    const repository = new PostgresFingerprintRepository(drizzle(pglite) as never);
    await pglite.exec(`
      INSERT INTO users (id, email) VALUES ('${SEEDED.userId}', 'perf@example.com');
      INSERT INTO videos (id, owner_id, source_key)
        SELECT gen_random_uuid(), '${SEEDED.userId}', 'raw/' || n FROM generate_series(1, ${VIDEOS}) n;
    `);
    await pglite.exec(`
      INSERT INTO video_frame_hashes (video_id, idx, hash, b0, b1, b2, b3)
        SELECT v.id, f.idx, f.hash,
          (f.hash & 65535)::int, ((f.hash >> 16) & 65535)::int, ((f.hash >> 32) & 65535)::int, ((f.hash >> 48) & 65535)::int
        FROM (SELECT id FROM videos) v,
          LATERAL (SELECT i AS idx, ((random() * 9.2e18)::bigint # (random() * 4e9)::bigint) AS hash FROM generate_series(0, ${FRAMES_PER_VIDEO - 1}) i) f;
      INSERT INTO video_audio_fingerprints (video_id, idx, term)
        SELECT v.id, i, ((random() * 4e9)::bigint - 2147483648)::int FROM videos v, generate_series(0, ${AUDIO_TERMS_PER_VIDEO - 1}) i;
      ANALYZE;
    `);

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
    const executionMs = async (query: string): Promise<number> => {
      const plan = await pglite.query<{ 'QUERY PLAN': { 'Execution Time': number }[] }>(
        `EXPLAIN (ANALYZE, FORMAT JSON) ${query}`
      );
      return plan.rows[0]?.['QUERY PLAN'][0]?.['Execution Time'] ?? Number.POSITIVE_INFINITY;
    };

    const frameMs = await executionMs(`
      SELECT video_id, idx, hash FROM video_frame_hashes
      WHERE video_id <> '00000000-0000-7000-8000-0000000000ff'
        AND (b0 IN (${list(0)}) OR b1 IN (${list(1)}) OR b2 IN (${list(2)}) OR b3 IN (${list(3)}))`);
    const audioMs = await executionMs(`
      SELECT video_id, idx, term FROM video_audio_fingerprints
      WHERE video_id <> '00000000-0000-7000-8000-0000000000ff' AND term IN (${terms.join(',')})`);
    const frames = expectOk(
      await repository.findFramesSharingBand(hashes, '00000000-0000-7000-8000-0000000000ff')
    );

    expect(frameMs, `frame lookup, ${frames.length} candidate rows`).toBeLessThan(BUDGET_MS);
    expect(audioMs, 'audio lookup').toBeLessThan(BUDGET_MS);
    await pglite.close();
  }, 600_000);
});
