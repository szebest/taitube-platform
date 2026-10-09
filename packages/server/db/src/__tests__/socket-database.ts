import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

export interface SocketDatabase {
  url: string;
  engine: PGlite;
  stop(): Promise<void>;
}

/**
 * An empty PGlite behind the Postgres wire protocol, so `runMigrations` and `seedDatabase` reach
 * it through the same `postgres` client they open against a real server.
 */
export async function startSocketDatabase(): Promise<SocketDatabase> {
  const engine = new PGlite({ extensions: { pg_trgm } });
  const server = new PGLiteSocketServer({ db: engine, port: 0, maxConnections: 10 });
  await server.start();
  return {
    url: `postgres://postgres@${server.getServerConn()}/postgres`,
    engine,
    stop: async () => {
      await server.stop();
      await engine.close();
    },
  };
}
