import { Container } from '@kit/composition';
import { databaseUnavailable } from '@kit/errors';
import { createIntl, createIntlCache } from '@kit/intl';
import { err, ok, unwrapOr } from '@kit/result';
import { PROBLEM_CONTENT_TYPE, problemFor } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { en, ERROR_COPY, LOCALES, sharedI18n } from '@vp/shared-messages';
import { pl } from '@vp/shared-messages/pl';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { registerFailureWords } from '../../composition/failure-words.module';
import { Services } from '../../composition/service-tokens';
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

const failureWords = registerFailureWords(new Container()).get(Services.FailureWords);

function requestFor(query: { locale?: string }, acceptLanguage?: string): FastifyRequest {
  return {
    url: '/v1/videos/v1',
    query,
    headers: { 'accept-language': acceptLanguage },
    server: { services: { failureWords } },
  } as unknown as FastifyRequest;
}

function clientWords(locale: string, key: (typeof ERROR_COPY)[keyof typeof ERROR_COPY]): string {
  const intl = createIntl({ locale, timeZone: 'UTC', cache: createIntlCache() });
  const catalogues = { locale: LOCALES.source, source: en, translations: { pl } };
  return unwrapOr(sharedI18n.createTranslator(intl, catalogues).t(key), '');
}

const request = requestFor({});
const forbidden = { code: ErrorCodes.FORBIDDEN, message: 'Not allowed', videoId: 'v1' } as const;
const notFound = { code: ErrorCodes.VIDEO_NOT_FOUND, message: 'Video v1 not found' } as const;

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
    expect(sent.body).toEqual(
      problemFor(forbidden, request.url, { detail: clientWords('en', ERROR_COPY.FORBIDDEN) })
    );
    expect(sent.headers['content-type']).toBe(PROBLEM_CONTENT_TYPE);
  });

  it.each([
    { scenario: 'en by default', failure: forbidden, query: {}, header: undefined, renders: 'en' },
    {
      scenario: 'pl by query',
      failure: forbidden,
      query: { locale: 'pl' },
      header: undefined,
      renders: 'pl',
    },
    {
      scenario: 'pl by header',
      failure: notFound,
      query: {},
      header: 'pl-PL,pl;q=0.9',
      renders: 'pl',
    },
    {
      scenario: 'en for an unknown locale',
      failure: notFound,
      query: { locale: 'de' },
      header: 'fr',
      renders: 'en',
    },
  ])(
    'renders the detail in the words the client shows, $scenario',
    ({ failure, query, header, renders }) => {
      const { reply, sent } = fakeReply();

      sendResult(reply, requestFor(query, header), err(failure));

      const words = clientWords(renders, ERROR_COPY[failure.code]);
      expect(words).not.toBe(failure.message);
      expect(sent.body).toMatchObject({
        code: failure.code,
        title: failure.message,
        detail: words,
      });
    }
  );

  it('adds the headers the route derives from the failure', () => {
    const { reply, sent } = fakeReply();

    sendResult(reply, request, err(forbidden), { headers: () => ({ 'retry-after': '30' }) });

    expect(sent.headers).toMatchObject({
      'retry-after': '30',
      'content-type': PROBLEM_CONTENT_TYPE,
    });
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

  it('sets the headers a failure carries, and none for a success', () => {
    const failed = fakeReply();
    const succeeded = fakeReply();
    const headers = (failure: typeof forbidden) => ({ 'retry-after': failure.videoId });

    sendResult(failed.reply, request, err(forbidden), { headers });
    sendResult(succeeded.reply, request, ok({ id: 'v1' }), { headers });

    expect(failed.sent.headers['retry-after']).toBe('v1');
    expect(succeeded.sent.headers['retry-after']).toBeUndefined();
  });

  it('keeps an infra payload off the wire', () => {
    const { reply, sent } = fakeReply();

    sendResult(reply, request, err(databaseUnavailable('findWithDetails')));

    expect(sent.status).toBe(503);
    expect(JSON.stringify(sent.body)).not.toContain('findWithDetails');
  });
});
