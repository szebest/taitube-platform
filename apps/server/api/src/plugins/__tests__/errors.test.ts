import * as http from 'node:http';
import * as net from 'node:net';
import { PROBLEM_CONTENT_TYPE } from '@vp/api-contracts';
import fastify from 'fastify';
import { boundPort } from '../../__tests__/bound-port';
import { problemClientErrorHandler, registerErrorHandler } from '../errors';

interface ClientErrorAnswer {
  status: number | undefined;
  headers: http.IncomingHttpHeaders;
  body: string;
}

async function answerToClientError(
  code: string,
  inFlightResponse: { headersSent: boolean } | null = null
): Promise<ClientErrorAnswer> {
  const serverSocketClosed: Promise<unknown>[] = [];
  const server = net.createServer((socket) => {
    socket.on('error', () => {});
    serverSocketClosed.push(new Promise((resolve) => socket.once('close', resolve)));
    socket.once('data', () =>
      problemClientErrorHandler(
        Object.assign(new Error('refused'), {
          code,
          bytesParsed: 0,
          rawPacket: { type: 'Buffer', data: [] },
        }),
        Object.assign(socket, { _httpMessage: inFlightResponse })
      )
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const answer = await new Promise<ClientErrorAnswer>((resolve, reject) => {
      http
        .get(
          { host: '127.0.0.1', port: boundPort(server), path: '/v1/videos', agent: false },
          (response) => {
            let body = '';
            response.setEncoding('utf-8');
            response.on('data', (chunk: string) => {
              body += chunk;
            });
            response.on('end', () =>
              resolve({ status: response.statusCode, headers: response.headers, body })
            );
          }
        )
        .on('error', reject);
    });
    await Promise.all(serverSocketClosed);
    return answer;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('apps/server/api/plugins: registerErrorHandler', () => {
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

describe('apps/server/api/plugins: problemClientErrorHandler', () => {
  it.each([
    { code: 'HPE_INVALID_METHOD', status: 400, title: 'Bad Request' },
    { code: 'ERR_HTTP_REQUEST_TIMEOUT', status: 408, title: 'Request Timeout' },
    { code: 'HPE_HEADER_OVERFLOW', status: 431, title: 'Request Header Fields Too Large' },
  ])('answers $code with a $status problem', async ({ code, status, title }) => {
    const response = await answerToClientError(code);

    expect(response.status).toBe(status);
    expect(response.headers).toMatchObject({
      'content-type': PROBLEM_CONTENT_TYPE,
      connection: 'close',
    });
    expect(JSON.parse(response.body)).toMatchObject({
      status,
      title,
      code: 'VALIDATION_FAILED',
      detail: 'refused',
    });
  });

  it('closes the connection without a second status line over a response already sent', async () => {
    await expect(answerToClientError('HPE_INVALID_METHOD', { headersSent: true })).rejects.toThrow(
      'socket hang up'
    );
  });
});
