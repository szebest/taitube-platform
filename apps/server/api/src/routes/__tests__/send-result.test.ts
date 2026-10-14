import { PROBLEM_CONTENT_TYPE, problemFor } from '@vp/api-contracts';
import { ErrorCodes, databaseUnavailable } from '@vp/errors';
import { err, ok } from '@vp/result';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendResult } from '../send-result';

interface Sent {
  status?: number;
  body?: unknown;
  headers: Record<string, string>;
}

function fakeReply(): { reply: FastifyReply; sent: Sent } {
  const sent: Sent = { headers: {} };
  const reply = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    send(body?: unknown) {
      sent.body = body;
      return this;
    },
    header(name: string, value: string) {
      sent.headers[name] = value;
      return this;
    },
  } as unknown as FastifyReply;

  return { reply, sent };
}

const request = { url: '/v1/videos/v1' } as FastifyRequest;
const forbidden = { code: ErrorCodes.FORBIDDEN, message: 'Not allowed', videoId: 'v1' } as const;

describe('sendResult', () => {
  it('sends the value with status 200 by default', () => {
    const { reply, sent } = fakeReply();

    sendResult(reply, request, ok({ id: 'v1' }));

    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({ id: 'v1' });
  });

  it('sends the value with the status the route asked for', () => {
    const { reply, sent } = fakeReply();

    sendResult(reply, request, ok({ id: 'v1' }), { status: 201 });

    expect(sent.status).toBe(201);
  });

  it('sends no body at all for a 204', () => {
    const { reply, sent } = fakeReply();

    sendResult(reply, request, ok(undefined), { status: 204 });

    expect(sent.status).toBe(204);
    expect(sent.body).toBeUndefined();
  });

  it('falls back to the total PROBLEM_STATUS mapping when the route passes nothing', () => {
    const { reply, sent } = fakeReply();

    sendResult(reply, request, err(forbidden));

    expect(sent.status).toBe(403);
    expect(sent.body).toEqual(problemFor(forbidden, request.url));
    expect(sent.headers['content-type']).toBe(PROBLEM_CONTENT_TYPE);
  });

  it('lets one route override one code without touching the service', () => {
    const { reply, sent } = fakeReply();

    sendResult(reply, request, err(forbidden), {
      on: {
        FORBIDDEN: (failure) =>
          problemFor(failure, request.url, { status: 404, detail: 'Video not found' }),
      },
    });

    expect(sent.status).toBe(404);
    expect((sent.body as { detail: string }).detail).toBe('Video not found');
  });

  it('hands the override the narrowed variant with its payload', () => {
    const { reply } = fakeReply();
    const seen: string[] = [];

    sendResult(reply, request, err(forbidden), {
      on: {
        FORBIDDEN: (failure) => {
          seen.push(failure.videoId);
          return problemFor(failure, request.url);
        },
      },
    });

    expect(seen).toEqual(['v1']);
  });

  it('prefers a per-code override over the total presenter', () => {
    const { reply, sent } = fakeReply();

    sendResult(reply, request, err(forbidden), {
      on: { FORBIDDEN: (f) => problemFor(f, request.url, { status: 418 }) },
      present: (f) => problemFor(f, request.url, { status: 451 }),
    });

    expect(sent.status).toBe(418);
  });

  it('uses the total presenter when no override matches', () => {
    const { reply, sent } = fakeReply();

    sendResult(reply, request, err(forbidden), {
      present: (f) => problemFor(f, request.url, { status: 451 }),
    });

    expect(sent.status).toBe(451);
  });

  it('keeps an infra payload off the wire', () => {
    const { reply, sent } = fakeReply();

    sendResult(reply, request, err(databaseUnavailable('findWithDetails')));

    expect(sent.status).toBe(503);
    expect(JSON.stringify(sent.body)).not.toContain('findWithDetails');
  });
});
