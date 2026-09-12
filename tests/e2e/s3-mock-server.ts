import * as http from 'node:http';
import type { InMemoryMultipartStorage, InMemoryStorageClient } from '../../adapters/index';

export interface MockS3ServerInstance {
  server: http.Server;
  baseUrl: string;
  close: () => Promise<void>;
}

/**
 * Creates and starts an in-process S3 HTTP server simulating presigned PUT/GET operations.
 */
export async function startMockS3Server(options: {
  storage: InMemoryStorageClient;
  multipart: InMemoryMultipartStorage;
}): Promise<MockS3ServerInstance> {
  const { storage, multipart } = options;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const parts = url.pathname.replace(/^\/+/, '').split('/');
    const bucket = parts[0] || 'raw';
    const key = parts.slice(1).join('/');

    if (req.method === 'PUT') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks);
      const uploadId = url.searchParams.get('uploadId');
      const partNumberStr = url.searchParams.get('partNumber');
      const etag = `"${Date.now()}-${Math.random().toString(36).slice(2, 8)}"`;

      if (uploadId && partNumberStr) {
        const partNum = Number.parseInt(partNumberStr, 10);
        multipart.seedPart(uploadId, partNum, body);
      } else {
        await storage.uploadObject({
          bucket,
          key,
          body,
          contentType: (req.headers['content-type'] as string) || 'application/octet-stream',
        });
      }

      res.statusCode = 200;
      res.setHeader('ETag', etag);
      res.setHeader('Content-Length', '0');
      res.end();
      return;
    }

    if (req.method === 'GET') {
      try {
        const data = await storage.getObject(bucket, key);
        const meta = await storage.headObject(bucket, key);
        res.statusCode = 200;
        res.setHeader('Content-Type', meta?.contentType || 'application/octet-stream');
        res.setHeader('Content-Length', String(data.length));
        res.end(data);
      } catch {
        res.statusCode = 404;
        res.end('Not Found');
      }
      return;
    }

    if (req.method === 'HEAD') {
      const meta = await storage.headObject(bucket, key);
      if (meta) {
        res.statusCode = 200;
        res.setHeader('Content-Type', meta.contentType);
        res.setHeader('Content-Length', String(meta.contentLength));
        res.end();
      } else {
        res.statusCode = 404;
        res.end();
      }
      return;
    }

    res.statusCode = 405;
    res.end('Method Not Allowed');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const s3Address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${s3Address.port}`;

  // Configure presigned URL hooks on the in-memory adapters
  storage.createPresignedPutUrl = async (params) => {
    const expiresIn = params.expiresInSeconds ?? 900;
    return {
      url: `${baseUrl}/${params.bucket}/${params.key}`,
      headers: {
        'content-type': params.contentType,
        'content-length': String(params.contentLength ?? 0),
      },
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  };

  multipart.createPresignedPartUrl = async (params) => {
    const expiresIn = params.expiresInSeconds ?? 900;
    return {
      partNumber: params.partNumber,
      url: `${baseUrl}/${params.bucket}/${params.key}?uploadId=${params.uploadId}&partNumber=${params.partNumber}`,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  };

  storage.createPresignedGetUrl = async (params) => {
    return `${baseUrl}/${params.bucket}/${params.key}`;
  };

  const close = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  };

  return { server, baseUrl, close };
}
