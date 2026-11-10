import { runMigrations } from '../migrate';
import {
  screeningAppeals,
  videoAudioFingerprints,
  videoFrameHashes,
  videoScreenings,
} from '../screening-schema';
import { referenceFrom } from './foreign-key';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

const quiet = { info: () => {}, warn: () => {} };
const USER = '00000000-0000-7000-8000-0000000112a1';
const VIDEO = '00000000-0000-7000-8000-0000000112b1';
const SCREENING = '00000000-0000-7000-8000-0000000112c1';

describe('db: screening schema', () => {
  it.each([
    [videoScreenings, 'video_id', 'videos', 'cascade'],
    [videoScreenings, 'decided_by', 'users', 'set null'],
    [videoFrameHashes, 'video_id', 'videos', 'cascade'],
    [videoAudioFingerprints, 'video_id', 'videos', 'cascade'],
    [screeningAppeals, 'video_id', 'videos', 'cascade'],
    [screeningAppeals, 'screening_id', 'video_screenings', 'cascade'],
    [screeningAppeals, 'rejected_by', 'users', 'set null'],
  ] as const)('%s.%s references %s on delete %s', (table, column, parent, onDelete) => {
    expect(referenceFrom(table, column)).toEqual({ table: parent, onDelete });
  });
});

describe('db: screening migration', () => {
  let database: SocketDatabase;

  beforeAll(async () => {
    database = await startSocketDatabase();
    await runMigrations(database.url, quiet);
    await database.engine.exec(`
      insert into users (id, email) values ('${USER}', 'screening@x.local');
      insert into videos (id, owner_id, source_key, status)
        values ('${VIDEO}', '${USER}', 'raw/x.mp4', 'HELD');
      insert into video_screenings (id, video_id, source_checksum, outcome, score, threshold_version)
        values ('${SCREENING}', '${VIDEO}', 'sum-1', 'HOLD', 0.93, 'v1');
    `);
  });

  afterAll(async () => {
    await database.stop();
  });

  it('keeps one result per video and source checksum', async () => {
    await expect(
      database.engine.exec(`
        insert into video_screenings (id, video_id, source_checksum, outcome, score, threshold_version)
          values ('00000000-0000-7000-8000-0000000112c2', '${VIDEO}', 'sum-1', 'PASS', 0, 'v1')
      `)
    ).rejects.toThrow(/video_screenings_video_checksum_idx/);
  });

  it.each([
    { column: 'outcome', value: 'MAYBE', constraint: /video_screenings_outcome_check/ },
    { column: 'decision', value: 'banned', constraint: /video_screenings_decision_check/ },
  ])('refuses a $column of $value', async ({ column, value, constraint }) => {
    const outcome = column === 'outcome' ? value : 'HOLD';
    const decision = column === 'decision' ? `'${value}'` : 'null';

    await expect(
      database.engine.exec(`
        insert into video_screenings (id, video_id, source_checksum, outcome, score, threshold_version, decision)
          values ('00000000-0000-7000-8000-0000000112c3', '${VIDEO}', 'sum-2', '${outcome}', 0, 'v1', ${decision})
      `)
    ).rejects.toThrow(constraint);
  });

  it('allows one open appeal per video', async () => {
    await database.engine.exec(`
      insert into screening_appeals (id, video_id, screening_id, author_id, message)
        values ('00000000-0000-7000-8000-0000000112d1', '${VIDEO}', '${SCREENING}', '${USER}', 'Please look again')
    `);

    await expect(
      database.engine.exec(`
        insert into screening_appeals (id, video_id, screening_id, author_id, message)
          values ('00000000-0000-7000-8000-0000000112d2', '${VIDEO}', '${SCREENING}', '${USER}', 'Again')
      `)
    ).rejects.toThrow(/screening_appeals_open_idx/);
  });

  it('indexes every band of a frame hash and the audio term', async () => {
    const { rows } = await database.engine.query<{ indexname: string }>(
      "select indexname from pg_indexes where tablename in ('video_frame_hashes', 'video_audio_fingerprints') and indexname like '%\\_idx' order by indexname"
    );

    expect(rows.map((row) => row.indexname)).toEqual([
      'video_audio_fingerprints_term_idx',
      'video_frame_hashes_b0_idx',
      'video_frame_hashes_b1_idx',
      'video_frame_hashes_b2_idx',
      'video_frame_hashes_b3_idx',
    ]);
  });

  it('takes the fingerprints and the results with their video', async () => {
    await database.engine.exec(`
      insert into video_frame_hashes (video_id, idx, hash, b0, b1, b2, b3) values ('${VIDEO}', 0, -1, -1, -1, -1, -1);
      insert into video_audio_fingerprints (video_id, idx, term) values ('${VIDEO}', 0, 7);
      delete from videos where id = '${VIDEO}';
    `);
    const { rows } = await database.engine.query<{ n: number }>(
      'select (select count(*) from video_frame_hashes) + (select count(*) from video_audio_fingerprints) + (select count(*) from video_screenings) + (select count(*) from screening_appeals) as n'
    );

    expect(Number(rows[0]?.n)).toBe(0);
  });
});
