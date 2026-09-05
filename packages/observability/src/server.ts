import * as http from 'node:http';
import type { Registry } from 'prom-client';

export interface MetricsServerOptions {
  port: number;
  host?: string;
  registry: Registry;
}

export interface MetricsServer {
  server: http.Server;
  port: number;
  close: () => Promise<void>;
}

export async function startMetricsServer(
  options: MetricsServerOptions | number,
  registryArg?: Registry
): Promise<MetricsServer> {
  const port = typeof options === 'number' ? options : options.port;
  const host = typeof options === 'number' ? '0.0.0.0' : options.host ?? '0.0.0.0';
  const registry = typeof options === 'number' ? (registryArg as Registry) : options.registry;

  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics' && req.method === 'GET') {
      try {
        const metrics = await registry.metrics();
        res.writeHead(200, { 'Content-Type': registry.contentType });
        res.end(metrics);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end((err as Error).message);
      }
      return;
    }

    if (req.url === '/healthz' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr !== null ? addr.port : port;

  return {
    server,
    port: actualPort,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
