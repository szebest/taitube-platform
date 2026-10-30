import { PgDialect } from 'drizzle-orm/pg-core';
import { transcriptVector, videoCaptions, videoTranscriptCues } from '../captions-schema';
import { runMigrations } from '../migrate';
import { referenceFrom } from './foreign-key';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

const quiet = { info: () => {}, warn: () => {} };
const VIDEO = '00000000-0000-7000-8000-0000000111a1';
const CAPTION = '00000000-0000-7000-8000-0000000111c1';

describe('db: captions schema', () => {
  it.each([
    [videoCaptions, 'video_id', 'videos'],
    [videoTranscriptCues, 'caption_id', 'video_captions'],
  ] as const)('drops the rows with their %s parent', (table, column, parent) => {
    expect(referenceFrom(table, column)).toEqual({ table: parent, onDelete: 'cascade' });
  });

  it('names the cue vector with its table', () => {
    expect(new PgDialect().sqlToQuery(transcriptVector).sql).toBe(
      '"video_transcript_cues"."text_vector"'
    );
  });
});

describe('db: captions migration', () => {
  let database: SocketDatabase;

  beforeAll(async () => {
    database = await startSocketDatabase();
    await runMigrations(database.url, quiet);
    await database.engine.exec(`
      insert into users (id, email) values ('${VIDEO}', 'captions@x.local');
      insert into videos (id, owner_id, source_key) values ('${VIDEO}', '${VIDEO}', 'raw/x.mp4');
      insert into video_captions (id, video_id, kind, status)
        values ('${CAPTION}', '${VIDEO}', 'auto', 'pending');
      insert into video_transcript_cues (caption_id, cue_index, start_ms, end_ms, text)
        values ('${CAPTION}', 0, 0, 1000, 'Hello wide world');
    `);
  });

  afterAll(async () => {
    await database.stop();
  });

  it('finds a cue by its words through the simple vector', async () => {
    const { rows } = await database.engine.query<{ cue_index: number }>(
      "select cue_index from video_transcript_cues where text_vector @@ websearch_to_tsquery('simple', 'wide')"
    );

    expect(rows).toEqual([{ cue_index: 0 }]);
  });

  it('refuses a second generated track for one video', async () => {
    await expect(
      database.engine.exec(`
        insert into video_captions (id, video_id, kind, status)
          values ('00000000-0000-7000-8000-0000000111c2', '${VIDEO}', 'edited', 'ready')
      `)
    ).rejects.toThrow(/video_captions_generated_idx/);
  });

  it('starts a channel opted out and a video following its channel', async () => {
    await database.engine.exec(`
      insert into channels (id, user_id, handle, display_name)
        values ('${VIDEO}', '${VIDEO}', 'captions', 'Captions')
    `);
    const { rows } = await database.engine.query<{ channel: boolean; video: boolean | null }>(
      'select c.auto_captions_default as channel, v.auto_captions as video from channels c join videos v on v.owner_id = c.user_id'
    );

    expect(rows).toEqual([{ channel: false, video: null }]);
  });
});
