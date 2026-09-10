import { InMemoryCacheClient, InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('OpenAPI 3.1 & Scalar Documentation Contract (Ticket 19)', () => {
  let app: FastifyInstance;
  let swaggerSpec: Record<string, unknown>;

  beforeAll(async () => {
    app = await buildApp({
      repositories: new InMemoryRepositories(),
      cache: new InMemoryCacheClient(),
      storage: new InMemoryStorageClient(),
      cdnBaseUrl: 'http://localhost:9000/public',
    });
    await app.ready();
    swaggerSpec = app.swagger() as Record<string, unknown>;
  });

  afterAll(async () => {
    await app.close();
  });

  it('AC 4, 7 & 8: Scalar UI mounted at /docs, redirects from /docs, serves offline JS', async () => {
    // 1. GET /docs redirects to /docs/ with 301
    const redirectRes = await app.inject({
      method: 'GET',
      url: '/docs',
    });
    expect([301, 302]).toContain(redirectRes.statusCode);
    expect(redirectRes.headers.location).toMatch(/\/docs\/$/);

    // 2. GET /docs/ returns HTML with Scalar reference
    const htmlRes = await app.inject({
      method: 'GET',
      url: '/docs/',
    });
    expect(htmlRes.statusCode).toBe(200);
    expect(htmlRes.headers['content-type']).toContain('text/html');
    expect(htmlRes.body).toContain('js/scalar.js');

    // 3. GET /docs/js/scalar.js returns bundled standalone javascript (local-first, no external CDN)
    const jsRes = await app.inject({
      method: 'GET',
      url: '/docs/js/scalar.js',
    });
    expect(jsRes.statusCode).toBe(200);
    expect(jsRes.headers['content-type']).toContain('application/javascript');
    expect(jsRes.body.length).toBeGreaterThan(10000); // Bundled Scalar script is substantial

    // 4. GET /docs/openapi.json and GET /openapi.json return OpenAPI 3.1 specification
    const specDocsRes = await app.inject({
      method: 'GET',
      url: '/docs/openapi.json',
    });
    expect(specDocsRes.statusCode).toBe(200);
    expect(specDocsRes.headers['content-type']).toContain('application/json');
    const docsJson = specDocsRes.json();
    expect(docsJson.openapi).toMatch(/^3\.1\./);

    const specAliasRes = await app.inject({
      method: 'GET',
      url: '/openapi.json',
    });
    expect(specAliasRes.statusCode).toBe(200);
    expect(specAliasRes.headers['content-type']).toContain('application/json');
    const aliasJson = specAliasRes.json();
    expect(aliasJson.openapi).toMatch(/^3\.1\./);
  });

  it('AC 4: Spec contains securitySchemes, servers, and info matching PRD/SDD', () => {
    expect(swaggerSpec['openapi']).toMatch(/^3\.1\./);

    const info = swaggerSpec['info'] as { title?: string; version?: string; description?: string };
    expect(info?.title).toBe('video-pipeline API');
    expect(info?.version).toBe('1.0.0');
    expect(info?.description).toContain('public CDN'); // PRD OQ-2 note

    const servers = swaggerSpec['servers'] as Array<{ url: string }>;
    expect(Array.isArray(servers)).toBe(true);
    expect(servers.some((s) => s.url.includes('3000'))).toBe(true);

    const components = swaggerSpec['components'] as {
      securitySchemes?: Record<
        string,
        { type: string; scheme?: string; in?: string; name?: string }
      >;
    };
    expect(components?.securitySchemes).toBeDefined();
    expect(components.securitySchemes?.['bearerAuth']).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Dev or production bearer JWT',
    });
    expect(components.securitySchemes?.['adminToken']).toEqual({
      type: 'apiKey',
      in: 'header',
      name: 'x-admin-token',
      description: 'Static admin token for administrative operations',
    });
  });

  interface SddEndpointContract {
    path: string;
    method: 'get' | 'post' | 'patch' | 'delete';
    expectedStatuses: number[];
    expectedErrorCodes?: string[];
    hasQueryParams?: boolean;
    hasBody?: boolean;
    hasPathParams?: boolean;
  }

  const CONTRACT: SddEndpointContract[] = [
    // 1. Uploads (§6.1)
    {
      path: '/v1/uploads',
      method: 'post',
      expectedStatuses: [201, 400, 401, 422, 429],
      expectedErrorCodes: [
        ErrorCodes.VALIDATION_FAILED,
        ErrorCodes.UNAUTHORIZED,
        ErrorCodes.UPLOAD_TOO_LARGE,
        ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
        ErrorCodes.QUOTA_EXCEEDED,
        ErrorCodes.RATE_LIMITED,
      ],
      hasBody: true,
    },
    {
      path: '/v1/uploads/{uploadId}',
      method: 'get',
      expectedStatuses: [200, 400, 401, 403, 404],
      expectedErrorCodes: [
        ErrorCodes.VALIDATION_FAILED,
        ErrorCodes.UNAUTHORIZED,
        ErrorCodes.FORBIDDEN,
        ErrorCodes.VIDEO_NOT_FOUND,
      ],
      hasPathParams: true,
    },
    {
      path: '/v1/uploads/{uploadId}/parts',
      method: 'post',
      expectedStatuses: [200, 400, 401, 403, 404, 410],
      expectedErrorCodes: [
        ErrorCodes.VALIDATION_FAILED,
        ErrorCodes.UNAUTHORIZED,
        ErrorCodes.FORBIDDEN,
        ErrorCodes.VIDEO_NOT_FOUND,
        ErrorCodes.UPLOAD_NOT_OPEN,
      ],
      hasQueryParams: true,
      hasPathParams: true,
    },
    {
      path: '/v1/uploads/{uploadId}/complete',
      method: 'post',
      expectedStatuses: [202, 400, 401, 403, 404, 410, 422],
      expectedErrorCodes: [
        ErrorCodes.VALIDATION_FAILED,
        ErrorCodes.UNAUTHORIZED,
        ErrorCodes.FORBIDDEN,
        ErrorCodes.VIDEO_NOT_FOUND,
        ErrorCodes.UPLOAD_NOT_OPEN,
        ErrorCodes.UPLOAD_SIZE_MISMATCH,
        ErrorCodes.UPLOAD_TOO_LARGE,
        ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
      ],
      hasBody: true,
      hasPathParams: true,
    },
    {
      path: '/v1/uploads/{uploadId}',
      method: 'delete',
      expectedStatuses: [204, 400, 401, 403, 404],
      expectedErrorCodes: [
        ErrorCodes.VALIDATION_FAILED,
        ErrorCodes.UNAUTHORIZED,
        ErrorCodes.FORBIDDEN,
        ErrorCodes.VIDEO_NOT_FOUND,
      ],
      hasPathParams: true,
    },

    // 2. Videos (§6.1)
    {
      path: '/v1/videos',
      method: 'get',
      expectedStatuses: [200, 400, 401],
      expectedErrorCodes: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.UNAUTHORIZED],
      hasQueryParams: true,
    },
    {
      path: '/v1/videos/{id}',
      method: 'get',
      expectedStatuses: [200, 400, 401, 404],
      expectedErrorCodes: [
        ErrorCodes.VALIDATION_FAILED,
        ErrorCodes.UNAUTHORIZED,
        ErrorCodes.VIDEO_NOT_FOUND,
      ],
      hasPathParams: true,
    },
    {
      path: '/v1/videos/{id}',
      method: 'patch',
      expectedStatuses: [200, 400, 401, 403, 404, 409],
      expectedErrorCodes: [
        ErrorCodes.VALIDATION_FAILED,
        ErrorCodes.UNAUTHORIZED,
        ErrorCodes.FORBIDDEN,
        ErrorCodes.VIDEO_NOT_FOUND,
        ErrorCodes.VERSION_CONFLICT,
      ],
      hasBody: true,
      hasPathParams: true,
    },
    {
      path: '/v1/videos/{id}',
      method: 'delete',
      expectedStatuses: [202, 400, 401, 403, 404],
      expectedErrorCodes: [
        ErrorCodes.VALIDATION_FAILED,
        ErrorCodes.UNAUTHORIZED,
        ErrorCodes.FORBIDDEN,
        ErrorCodes.VIDEO_NOT_FOUND,
      ],
      hasPathParams: true,
    },
    {
      path: '/v1/videos/{id}/events',
      method: 'get',
      expectedStatuses: [200, 400, 401, 404, 429],
      expectedErrorCodes: [
        ErrorCodes.VALIDATION_FAILED,
        ErrorCodes.UNAUTHORIZED,
        ErrorCodes.VIDEO_NOT_FOUND,
        ErrorCodes.RATE_LIMITED,
      ],
      hasPathParams: true,
    },
    {
      path: '/v1/me/events',
      method: 'get',
      expectedStatuses: [200, 401, 429],
      expectedErrorCodes: [ErrorCodes.UNAUTHORIZED, ErrorCodes.RATE_LIMITED],
    },
    {
      path: '/v1/videos/{id}/reprocess',
      method: 'post',
      expectedStatuses: [202, 400, 401, 403, 404, 429],
      expectedErrorCodes: [
        ErrorCodes.VALIDATION_FAILED,
        ErrorCodes.UNAUTHORIZED,
        ErrorCodes.FORBIDDEN,
        ErrorCodes.VIDEO_NOT_FOUND,
        ErrorCodes.RATE_LIMITED,
      ],
      hasBody: true,
      hasPathParams: true,
    },

    // 3. Admin (§6.1)
    {
      path: '/v1/admin/dlq',
      method: 'get',
      expectedStatuses: [200, 401, 403],
      expectedErrorCodes: [ErrorCodes.UNAUTHORIZED, ErrorCodes.FORBIDDEN],
      hasQueryParams: true,
    },
    {
      path: '/v1/admin/dlq/{id}/replay',
      method: 'post',
      expectedStatuses: [202, 400, 401, 403, 404],
      expectedErrorCodes: [
        ErrorCodes.VALIDATION_FAILED,
        ErrorCodes.UNAUTHORIZED,
        ErrorCodes.FORBIDDEN,
        ErrorCodes.DLQ_ENTRY_NOT_FOUND,
      ],
      hasBody: true,
      hasPathParams: true,
    },
    {
      path: '/v1/admin/dlq/{id}',
      method: 'delete',
      expectedStatuses: [204, 400, 401, 403, 404],
      expectedErrorCodes: [
        ErrorCodes.VALIDATION_FAILED,
        ErrorCodes.UNAUTHORIZED,
        ErrorCodes.FORBIDDEN,
        ErrorCodes.DLQ_ENTRY_NOT_FOUND,
      ],
      hasPathParams: true,
    },

    // 4. Ops (§6.1)
    {
      path: '/healthz',
      method: 'get',
      expectedStatuses: [200],
    },
    {
      path: '/readyz',
      method: 'get',
      expectedStatuses: [200, 503],
    },
  ];

  it.each(CONTRACT)('AC 6: endpoint $method $path adheres to OpenAPI contract', (item) => {
    const paths = (swaggerSpec['paths'] || {}) as Record<
      string,
      Record<
        string,
        {
          parameters?: Array<{ name: string; in: string }>;
          requestBody?: unknown;
          responses?: Record<
            string,
            { content?: Record<string, { schema?: Record<string, unknown> }> }
          >;
        }
      >
    >;

    const pathItem = paths[item.path];
    expect(pathItem, `Expected endpoint "${item.path}" to exist in OpenAPI spec`).toBeDefined();

    const op = pathItem?.[item.method];
    expect(
      op,
      `Expected HTTP method "${item.method.toUpperCase()}" for path "${item.path}"`
    ).toBeDefined();

    if (item.hasPathParams) {
      expect(
        op?.parameters?.some((p) => p.in === 'path'),
        `Expected path parameter for ${item.method.toUpperCase()} ${item.path}`
      ).toBe(true);
    }

    if (item.hasQueryParams) {
      expect(
        op?.parameters?.some((p) => p.in === 'query'),
        `Expected query parameter for ${item.method.toUpperCase()} ${item.path}`
      ).toBe(true);
    }

    if (item.hasBody) {
      expect(
        op?.requestBody,
        `Expected requestBody for ${item.method.toUpperCase()} ${item.path}`
      ).toBeDefined();
    }

    const responses = op?.responses || {};
    for (const status of item.expectedStatuses) {
      expect(
        responses[String(status)],
        `Expected status ${status} response schema in ${item.method.toUpperCase()} ${item.path}`
      ).toBeDefined();
    }

    if (item.expectedErrorCodes && item.expectedErrorCodes.length > 0) {
      const errorStatuses = item.expectedStatuses.filter((s) => s >= 400);
      const documentedCodes: string[] = [];

      for (const s of errorStatuses) {
        const resp = responses[String(s)];
        const content = resp?.content || {};
        const schema = (content['application/problem+json']?.schema ??
          content['application/json']?.schema) as {
          properties?: { code?: { enum?: string[] } };
        };
        const codeEnum = schema?.properties?.code?.enum;
        if (Array.isArray(codeEnum)) {
          documentedCodes.push(...codeEnum);
        }
      }

      for (const code of item.expectedErrorCodes) {
        expect(
          documentedCodes,
          `Expected error code "${code}" to be documented in error responses for ${item.method.toUpperCase()} ${item.path}`
        ).toContain(code);
      }
    }
  });

  it('detects no drift between /v1/ endpoints in OpenAPI and the SDD contract', () => {
    const paths = (swaggerSpec['paths'] || {}) as Record<string, Record<string, unknown>>;
    const contractKeys = new Set(CONTRACT.map((c) => `${c.method.toUpperCase()} ${c.path}`));
    for (const [p, methods] of Object.entries(paths)) {
      if (p.startsWith('/v1/')) {
        for (const m of Object.keys(methods)) {
          const key = `${m.toUpperCase()} ${p}`;
          expect(
            contractKeys.has(key),
            `Endpoint ${key} is exposed in OpenAPI but missing from SDD §6.1 contract table`
          ).toBe(true);
        }
      }
    }
  });
});
