import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { S3MultipartStorage, S3StorageClient } from '@vp/adapters';

interface StoredObject {
  size: number;
  contentType: string;
}

interface FakePart {
  partNumber: number;
  etag: string;
  size: number;
}

export interface FakeS3 {
  endpoint: string;
  objects: Map<string, StoredObject>;
  signedLengths: Map<string, number>;
  multipartUploads: Map<string, { key: string; parts: FakePart[] }>;
  storage: S3StorageClient;
  multipart: S3MultipartStorage;
  close(): Promise<void>;
}

const ETAG = '"d41d8cd98f00b204e9800998ecf8427e"';
const SIGNATURE_MISMATCH =
  '<Error><Code>SignatureDoesNotMatch</Code><Message>The request signature we calculated does not match the signature you provided.</Message></Error>';

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function reply(res: http.ServerResponse, status: number, headers = {}, body?: string): void {
  res.writeHead(status, headers);
  res.end(body);
}

/**
 * A path-style S3 endpoint that enforces the signed Content-Length of a presigned PUT, the way
 * MinIO does, and keeps single objects and multipart uploads in inspectable maps.
 */
export async function startFakeS3(): Promise<FakeS3> {
  const objects = new Map<string, StoredObject>();
  const signedLengths = new Map<string, number>();
  const multipartUploads = new Map<string, { key: string; parts: FakePart[] }>();
  let uploadSequence = 0;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const key = url.pathname.replace(/^\/+/, '').split('/').slice(1).join('/');
    const uploadId = url.searchParams.get('uploadId') ?? '';
    const upload = multipartUploads.get(uploadId);

    if (req.method === 'POST' && url.searchParams.has('uploads')) {
      const id = `mp-${++uploadSequence}`;
      multipartUploads.set(id, { key, parts: [] });
      return reply(
        res,
        200,
        { 'content-type': 'application/xml' },
        `<InitiateMultipartUploadResult><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`
      );
    }

    if (req.method === 'PUT' && url.searchParams.has('partNumber') && uploadId) {
      const partNumber = Number(url.searchParams.get('partNumber') ?? 1);
      const body = await readBody(req);
      upload?.parts.push({ partNumber, etag: `etag-${partNumber}`, size: body.length || 8388608 });
      return reply(res, 200, { ETag: `"etag-${partNumber}"` });
    }

    if (req.method === 'GET' && uploadId) {
      if (!upload) return reply(res, 404);
      const partsXml = upload.parts
        .map(
          (p) =>
            `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>"${p.etag}"</ETag><Size>${p.size}</Size></Part>`
        )
        .join('');
      return reply(
        res,
        200,
        { 'content-type': 'application/xml' },
        `<ListPartsResult><IsTruncated>false</IsTruncated>${partsXml}</ListPartsResult>`
      );
    }

    if (req.method === 'POST' && uploadId) {
      if (!upload) return reply(res, 404);
      const size = upload.parts.reduce((total, p) => total + p.size, 0);
      objects.set(key, { size, contentType: 'video/mp4' });
      return reply(
        res,
        200,
        { 'content-type': 'application/xml' },
        `<CompleteMultipartUploadResult><Location>http://localhost/${key}</Location><ETag>"final-etag"</ETag></CompleteMultipartUploadResult>`
      );
    }

    if (req.method === 'DELETE' && uploadId) {
      multipartUploads.delete(uploadId);
      return reply(res, 204);
    }

    if (req.method === 'PUT') {
      const declaredLength = Number(req.headers['content-length'] ?? -1);
      const body = await readBody(req);
      const expected = signedLengths.get(key);
      if (
        (expected !== undefined && (declaredLength !== expected || body.length !== expected)) ||
        (declaredLength !== -1 && body.length !== declaredLength)
      ) {
        return reply(res, 400, { 'Content-Type': 'application/xml' }, SIGNATURE_MISMATCH);
      }
      objects.set(key, {
        size: body.length,
        contentType: req.headers['content-type'] || 'application/octet-stream',
      });
      return reply(res, 200, { ETag: ETAG, 'Content-Length': '0' });
    }

    if (req.method === 'HEAD') {
      const found = objects.get(key);
      if (!found) return reply(res, 404);
      return reply(res, 200, {
        'Content-Length': String(found.size),
        'Content-Type': found.contentType,
        ETag: ETAG,
      });
    }

    if (req.method === 'DELETE') {
      objects.delete(key);
      return reply(res, 204);
    }

    reply(res, 404);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const storage = new S3StorageClient({
    type: 'connection',
    endpoint,
    region: 'us-east-1',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    forcePathStyle: true,
  });

  return {
    endpoint,
    objects,
    signedLengths,
    multipartUploads,
    storage,
    multipart: new S3MultipartStorage({ type: 'storage', storageClient: storage }),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
