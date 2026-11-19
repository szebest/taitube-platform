import * as http from 'node:http';
import { type Result, fromPromise, isErr, ok } from '@kit/result';
import type { Registry } from 'prom-client';

export interface MetricsRoutes {
  metrics: string;
  health: string;
  /** Answered only when `ready` is given. */
  ready: string;
}

export interface MetricsServerOptions {
  port: number;
  host: string;
  registry: Registry;
  routes: MetricsRoutes;
  /** Serves the ready route when given: 200 while it answers `true`, 503 otherwise. */
  ready?: () => Promise<boolean>;
}

type Reply = { status: number; contentType: string; body: string };

function toError(cause: unknown): Error {
  if (cause instanceof Error) return cause;
  return new Error('metrics server failed', { cause });
}

const text = (status: number, body: string): Reply => ({
  status,
  contentType: 'text/plain',
  body,
});

/**
 * The process's one scrape endpoint. Constructing it opens nothing, so a composition root can
 * build it with the graph and `listen()` it as the first thing the process starts.
 */
export class MetricsServer {
  private readonly server: http.Server;

  constructor(private readonly options: MetricsServerOptions) {
    this.server = http.createServer((req, res) => {
      void this.reply(req).then(({ status, contentType, body }) => {
        res.writeHead(status, { 'Content-Type': contentType });
        res.end(body);
      });
    });
  }

  get port(): number {
    const address = this.server.address();
    return typeof address === 'object' && address !== null ? address.port : this.options.port;
  }

  listen(): Promise<Result<void, Error>> {
    return fromPromise(
      new Promise<void>((resolve, reject) => {
        this.server.once('error', reject);
        this.server.listen(this.options.port, this.options.host, () => {
          this.server.removeListener('error', reject);
          resolve();
        });
      }),
      toError
    );
  }

  close(): Promise<Result<void, Error>> {
    if (!this.server.listening) return Promise.resolve(ok());
    return fromPromise(
      new Promise<void>((resolve, reject) => {
        this.server.close((error) => (error ? reject(error) : resolve()));
      }),
      toError
    );
  }

  private async reply(req: http.IncomingMessage): Promise<Reply> {
    if (req.method !== 'GET') return text(404, 'Not Found');

    const { routes } = this.options;
    switch (req.url) {
      case routes.metrics: {
        const { registry } = this.options;
        const scraped = await fromPromise(() => registry.metrics(), toError);
        return isErr(scraped)
          ? text(500, scraped.error.message)
          : { status: 200, contentType: registry.contentType, body: scraped.value };
      }
      case routes.health:
        return text(200, 'ok');
      case routes.ready: {
        const { ready } = this.options;
        if (!ready) return text(404, 'Not Found');
        const answered = await fromPromise(ready, () => false);
        return answered.ok && answered.value ? text(200, 'ready') : text(503, 'not ready');
      }
      default:
        return text(404, 'Not Found');
    }
  }
}
