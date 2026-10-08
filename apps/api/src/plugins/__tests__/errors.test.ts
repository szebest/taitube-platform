import * as http from 'node:http';
import * as net from 'node:net';
import { PROBLEM_CONTENT_TYPE } from '@vp/api-contracts';
import fastify from 'fastify';
import { boundPort } from '../../__tests__/bound-port';
import { problemClientErrorHandler, registerErrorHandler } from '../errors';

/** What a client reads back when the server hands its connection to the client error handler. */
async function answerToClientError(code: string) {
  const server = net.createServer((socket) => {
    socket.on('error', () => {});
    socket.once('data', () =>
      problemClientErrorHandler(
        Object.assign(new Error('refused'), {
          code,
          bytesParsed: 0,
          rawPacket: { type: 'Buffer', data: [] },
        }),
        socket
      )
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await new Promise<{ status?: number; contentType?: string; body: string }>(
      (resolve, reject) => {
        http
          .get({ host: '127.0.0.1', port: boundPort(server), path: '/v1/videos' }, (response) => {
            let body = '';
            response.setEncoding('utf-8');
            response.on('data', (chunk: string) => {
              body += chunk;
            });
            response.on('end', () =>
              resolve({
                status: response.statusCode,
                contentType: response.headers['content-type'],
                body,
              })
            );
          })
          .on('error', reject);
      }
    );
  } finally {
    server.close();
  }
}

describe('apps/api/plugins: registerErrorHandler', () => {
  it.each([
    { status: 400, title: 'Bad Request', code: 'VALIDATION_FAILED' },
    { status: 413, title: 'Payload Too Large', code: 'VALIDATION_FAILED' },
    { status: 415, title: 'Unsupported Media Type', code: 'UNSUPPORTED_CONTENT_TYPE' },
    { status: 401, title: 'Unauthorized', code: 'UNAUTHORIZED' },
  ])(
    'titles a transport $status from the HTTP status and names it $code',
    async ({ status, title, code }) => {
      const app = fastify({ logger: false });
      registerErrorHandler(app);
      app.get('/v1/uploads', async () => {
        throw Object.assign(new Error('refused'), { statusCode: status });
      });

      const response = await app.inject({ method: 'GET', url: '/v1/uploads' });

      expect(response.statusCode).toBe(status);
      expect(response.json()).toMatchObject({
        status,
        title,
        code,
        detail: 'refused',
        instance: '/v1/uploads',
      });
      await app.close();
    }
  );
});

describe('apps/api/plugins: problemClientErrorHandler', () => {
  it.each([
    { code: 'HPE_INVALID_METHOD', status: 400, title: 'Bad Request' },
    { code: 'ERR_HTTP_REQUEST_TIMEOUT', status: 408, title: 'Request Timeout' },
    { code: 'HPE_HEADER_OVERFLOW', status: 431, title: 'Request Header Fields Too Large' },
  ])('answers $code with a $status problem', async ({ code, status, title }) => {
    const response = await answerToClientError(code);

    expect(response.status).toBe(status);
    expect(response.contentType).toBe(PROBLEM_CONTENT_TYPE);
    expect(JSON.parse(response.body)).toMatchObject({
      status,
      title,
      code: 'VALIDATION_FAILED',
      detail: 'refused',
    });
  });
});
