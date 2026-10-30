import * as fs from 'node:fs';
import * as path from 'node:path';
import { runMigrations } from '../migrate';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

const ownerId = crypto.randomUUID();
const silent = { info: () => undefined, warn: () => undefined };
const [, backfill = ''] = fs
  .readFileSync(path.join(__dirname, '../../drizzle/0024_video_format.sql'), 'utf8')
  .split('--> statement-breakpoint');

describe('db: 0024 video format backfill', () => {
  let database: SocketDatabase;

  beforeAll(async () => {
    database = await startSocketDatabase();
    await runMigrations(database.url, silent);
    await database.engine.query(
      `insert into users (id, email) values ('${ownerId}', 'a@example.com')`
    );
  });

  afterAll(async () => {
    await database.stop();
  });

  it.each([
    {
      name: 'a portrait 45 s ready video',
      status: 'READY',
      w: 1080,
      h: 1920,
      ms: 45000,
      format: 'short',
    },
    {
      name: 'a portrait 45 s processing video',
      status: 'PROCESSING',
      w: 1080,
      h: 1920,
      ms: 45000,
      format: 'short',
    },
    {
      name: 'a portrait 180 s video',
      status: 'READY',
      w: 1080,
      h: 1920,
      ms: 180000,
      format: 'short',
    },
    {
      name: 'a landscape 45 s video',
      status: 'READY',
      w: 1920,
      h: 1080,
      ms: 45000,
      format: 'standard',
    },
    {
      name: 'a portrait 4 minute video',
      status: 'READY',
      w: 1080,
      h: 1920,
      ms: 240000,
      format: 'standard',
    },
    { name: 'a square video', status: 'READY', w: 1080, h: 1080, ms: 45000, format: 'standard' },
    {
      name: 'an unprobed video',
      status: 'UPLOADED',
      w: null,
      h: null,
      ms: null,
      format: 'standard',
    },
  ])('classifies $name as $format', async ({ status, w, h, ms, format }) => {
    const id = crypto.randomUUID();
    await database.engine.query(
      `insert into videos (id, owner_id, source_key, status, width, height, duration_ms)
       values ($1, '${ownerId}', 'k', $2, $3, $4, $5)`,
      [id, status, w, h, ms]
    );

    await database.engine.exec(backfill);
    const { rows } = await database.engine.query<{ format: string }>(
      'select format from videos where id = $1',
      [id]
    );

    expect(rows[0]?.format).toBe(format);
  });
});
