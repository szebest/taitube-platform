import * as http from 'node:http';
import { type Result, fromPromise, isErr, ok } from '@vp/result';
import type { Registry } from 'prom-client';

export interface MetricsServerOptions {
  port: number;
  host: string;
  registry: Registry;
  /** Serves `/readyz` when given: 200 while it answers `true`, 503 otherwise. */
  ready?: () => Promise<boolean>;
}

type Reply = { status: number; contentType: string; body: string };

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
      (cause) => cause as Error
    );
  }

  close(): Promise<Result<void, Error>> {
    if (!this.server.listening) return Promise.resolve(ok());
    return fromPromise(
      new Promise<void>((resolve, reject) => {
        this.server.close((error) => (error ? reject(error) : resolve()));
      }),
      (cause) => cause as Error
    );
  }

  private async reply(req: http.IncomingMessage): Promise<Reply> {
    if (req.method !== 'GET') return text(404, 'Not Found');

    switch (req.url) {
      case '/metrics': {
        const { registry } = this.options;
        const scraped = await fromPromise(
          () => registry.metrics(),
          (cause) => cause as Error
        );
        return isErr(scraped)
          ? text(500, scraped.error.message)
          : { status: 200, contentType: registry.contentType, body: scraped.value };
      }
      case '/healthz':
        return text(200, 'ok');
      case '/readyz': {
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
