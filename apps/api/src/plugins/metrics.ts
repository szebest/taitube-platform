import * as http from 'node:http';
import client from 'prom-client';

export interface MetricsServer {
  server: http.Server;
  port: number;
  close: () => Promise<void>;
}

export const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'vp_api_' });

export async function startMetricsServer(port: number): Promise<MetricsServer> {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics' && req.method === 'GET') {
      try {
        const metrics = await register.metrics();
        res.writeHead(200, { 'Content-Type': register.contentType });
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

  await new Promise<void>((resolve) => {
    server.listen(port, '0.0.0.0', () => {
      resolve();
    });
  });

  return {
    server,
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
