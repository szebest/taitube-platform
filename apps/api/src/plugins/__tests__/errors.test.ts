import fastify from 'fastify';
import { registerErrorHandler } from '../errors';

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
