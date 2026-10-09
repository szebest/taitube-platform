import fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { registerOpenApi } from '../openapi';

async function buildDocumentedApp() {
  const app = fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await registerOpenApi(app);
  await app.ready();
  return app;
}

describe('apps/api/composition: OpenAPI', () => {
  it('serves a 3.1.0 document with both security schemes', async () => {
    const app = await buildDocumentedApp();

    const res = await app.inject({ method: 'GET', url: '/openapi.json' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const spec = res.json();
    expect(spec.openapi).toBe('3.1.0');
    expect(Object.keys(spec.components.securitySchemes).sort()).toEqual([
      'adminToken',
      'bearerAuth',
    ]);

    await app.close();
  });

  it('mounts the reference UI at /docs', async () => {
    const app = await buildDocumentedApp();

    const res = await app.inject({ method: 'GET', url: '/docs' });

    expect([200, 301, 302]).toContain(res.statusCode);

    await app.close();
  });

  it('keeps the spec route itself out of the spec', async () => {
    const app = await buildDocumentedApp();

    const spec = (await app.inject({ method: 'GET', url: '/openapi.json' })).json();

    expect(spec.paths?.['/openapi.json']).toBeUndefined();

    await app.close();
  });
});
