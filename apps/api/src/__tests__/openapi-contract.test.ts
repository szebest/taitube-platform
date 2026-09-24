import type { FastifyInstance } from 'fastify';
import { SDD_ENDPOINT_CONTRACT } from './sdd-endpoint-contract';
import { buildTestApp } from './test-app';

interface OpenApiOperation {
  parameters?: Array<{ name: string; in: string }>;
  requestBody?: unknown;
  security?: unknown[];
  responses?: Record<string, { content?: Record<string, { schema?: ProblemSchema }> }>;
}

interface ProblemSchema {
  properties?: { code?: { enum?: string[] } };
}

interface OpenApiSpec {
  openapi: string;
  info?: { title?: string; version?: string; description?: string };
  servers: Array<{ url: string }>;
  components?: { securitySchemes?: Record<string, unknown> };
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

describe('OpenAPI 3.1 and Scalar documentation contract', () => {
  let app: FastifyInstance;
  let swaggerSpec: OpenApiSpec;

  beforeAll(async () => {
    ({ app } = await buildTestApp());
    swaggerSpec = (await app.inject({ method: 'GET', url: '/openapi.json' })).json();
  });

  afterAll(async () => {
    await app.close();
  });

  it('redirects /docs to /docs/, which serves the Scalar UI with its script bundled locally', async () => {
    const redirectRes = await app.inject({ method: 'GET', url: '/docs' });
    expect([301, 302]).toContain(redirectRes.statusCode);
    expect(redirectRes.headers.location).toMatch(/\/docs\/$/);

    const htmlRes = await app.inject({ method: 'GET', url: '/docs/' });
    expect(htmlRes.statusCode).toBe(200);
    expect(htmlRes.headers['content-type']).toContain('text/html');
    expect(htmlRes.body).toContain('js/scalar.js');

    const jsRes = await app.inject({ method: 'GET', url: '/docs/js/scalar.js' });
    expect(jsRes.statusCode).toBe(200);
    expect(jsRes.headers['content-type']).toContain('application/javascript');
    expect(jsRes.body.length).toBeGreaterThan(10000);
  });

  it.each(['/docs/openapi.json', '/openapi.json'])(
    'serves the OpenAPI 3.1 document at %s',
    async (url) => {
      const res = await app.inject({ method: 'GET', url });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.json().openapi).toMatch(/^3\.1\./);
    }
  );

  it('declares the info, servers and security schemes the PRD and SDD describe', () => {
    expect(swaggerSpec.openapi).toMatch(/^3\.1\./);
    expect(swaggerSpec.info?.title).toBe('video-pipeline API');
    expect(swaggerSpec.info?.version).toBe('1.0.0');
    expect(swaggerSpec.info?.description).toContain('public CDN');
    expect(Array.isArray(swaggerSpec.servers)).toBe(true);
    expect(swaggerSpec.servers.some((s) => s.url.includes('3000'))).toBe(true);

    const securitySchemes = swaggerSpec.components?.securitySchemes;
    expect(securitySchemes).toBeDefined();
    expect(securitySchemes?.['bearerAuth']).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Dev or production bearer JWT',
    });
    expect(securitySchemes?.['adminToken']).toEqual({
      type: 'apiKey',
      in: 'header',
      name: 'x-admin-token',
      description: 'Static admin token for administrative operations',
    });
  });

  it.each(SDD_ENDPOINT_CONTRACT)('documents $method $path as SDD §6.1 specifies', (item) => {
    const endpoint = `${item.method.toUpperCase()} ${item.path}`;
    const pathItem = swaggerSpec.paths?.[item.path];
    expect(pathItem, `Expected endpoint "${item.path}" to exist in OpenAPI spec`).toBeDefined();

    const op = pathItem?.[item.method];
    expect(op, `Expected HTTP method for ${endpoint}`).toBeDefined();

    if (item.hasPathParams) {
      expect(
        op?.parameters?.some((p) => p.in === 'path'),
        `Expected path parameter for ${endpoint}`
      ).toBe(true);
    }
    if (item.hasQueryParams) {
      expect(
        op?.parameters?.some((p) => p.in === 'query'),
        `Expected query parameter for ${endpoint}`
      ).toBe(true);
    }
    if (item.hasBody) {
      expect(op?.requestBody, `Expected requestBody for ${endpoint}`).toBeDefined();
    }

    const responses = op?.responses ?? {};
    for (const status of item.expectedStatuses) {
      expect(
        responses[String(status)],
        `Expected status ${status} response schema in ${endpoint}`
      ).toBeDefined();
    }

    const documentedCodes = item.expectedStatuses
      .filter((status) => status >= 400)
      .flatMap((status) => {
        const content = responses[String(status)]?.content ?? {};
        const schema =
          content['application/problem+json']?.schema ?? content['application/json']?.schema;
        return schema?.properties?.code?.enum ?? [];
      });
    for (const code of item.expectedErrorCodes ?? []) {
      expect(
        documentedCodes,
        `Expected error code "${code}" to be documented in error responses for ${endpoint}`
      ).toContain(code);
    }
  });

  it('exposes no /v1/ endpoint that the SDD contract table leaves out', () => {
    const contractKeys = new Set(
      SDD_ENDPOINT_CONTRACT.map((c) => `${c.method.toUpperCase()} ${c.path}`)
    );
    for (const [path, methods] of Object.entries(swaggerSpec.paths ?? {})) {
      if (!path.startsWith('/v1/')) continue;
      for (const method of Object.keys(methods)) {
        const key = `${method.toUpperCase()} ${path}`;
        expect(
          contractKeys.has(key),
          `Endpoint ${key} is exposed in OpenAPI but missing from SDD §6.1 contract table`
        ).toBe(true);
      }
    }
  });

  it('marks GET /v1/feed as requiring no authentication', () => {
    const feedGet = swaggerSpec.paths?.['/v1/feed']?.['get'];

    expect(feedGet).toBeDefined();
    expect(feedGet?.security).toEqual([]);
  });
});
