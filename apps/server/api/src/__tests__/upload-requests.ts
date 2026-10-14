import type { FastifyInstance } from 'fastify';
import { bearer } from './test-app';

export interface UploadRequest {
  filename: string;
  sizeBytes: number;
  contentType?: string;
  title?: string;
}

export function postUpload(app: FastifyInstance, token: string, request: UploadRequest) {
  return app.inject({
    method: 'POST',
    url: '/v1/uploads',
    headers: bearer(token),
    payload: { contentType: 'video/mp4', ...request },
  });
}

export function completeUpload(
  app: FastifyInstance,
  token: string,
  uploadId: string,
  parts?: Array<{ partNumber: number; etag: string }>
) {
  return app.inject({
    method: 'POST',
    url: `/v1/uploads/${uploadId}/complete`,
    headers: bearer(token),
    payload: parts ? { parts } : {},
  });
}

export function putObject(url: string, size: number, contentLength = size) {
  return fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(contentLength) },
    body: Buffer.alloc(size, 'x'),
  });
}
