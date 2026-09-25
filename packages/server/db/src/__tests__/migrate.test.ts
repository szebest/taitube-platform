import { runMigrations } from '../migrate';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

function recordingLog() {
  const messages: string[] = [];
  return {
    messages,
    log: {
      info: (_fields: Record<string, unknown>, message: string) => messages.push(message),
      warn: (_fields: Record<string, unknown>, message: string) => messages.push(message),
    },
  };
}

describe('db: runMigrations', () => {
  let database: SocketDatabase;

  beforeAll(async () => {
    database = await startSocketDatabase();
  });

  afterAll(async () => {
    await database.stop();
  });

  it('creates the schema on an empty database and applies nothing the second time', async () => {
    const first = recordingLog();
    const second = recordingLog();

    await runMigrations(database.url, first.log);
    await runMigrations(database.url, second.log);
    const { rows } = await database.engine.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'"
    );

    expect(rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining(['users', 'videos', 'uploads', 'renditions', 'outbox'])
    );
    expect(first.messages).toContain('migrations applied');
    expect(second.messages).toContain('migrations unchanged, nothing to apply');
  });
});
