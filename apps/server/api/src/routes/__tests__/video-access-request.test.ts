import { videoAccessCookieName } from '@vp/api-contracts';
import type { FastifyRequest } from 'fastify';
import { videoAccessOf, viewerSessionOf, watchRequestOf } from '../video-access-request';

const VIDEO = '00000000-0000-7000-8000-0000000005a1';
const SESSION = '0f8fad5b-d9cb-469f-a165-70867728950e';

const requestWith = (headers: Record<string, string>) => ({ headers }) as unknown as FastifyRequest;

describe('apps/server/api/routes: video access request', () => {
  it.each([
    { scenario: 'a UUID', header: SESSION, expected: SESSION },
    { scenario: 'nothing', header: undefined, expected: null },
    { scenario: 'a short value', header: 'abc', expected: null },
    { scenario: 'a value with spaces', header: 'a session key with spaces', expected: null },
    { scenario: 'an overlong value', header: 'a'.repeat(65), expected: null },
  ])('reads $scenario as session $expected', ({ header, expected }) => {
    const headers: Record<string, string> =
      header === undefined ? {} : { 'x-viewer-session': header };

    expect(viewerSessionOf(requestWith(headers))).toBe(expected);
  });

  it.each([
    {
      scenario: 'its own cookie',
      cookie: `${videoAccessCookieName(VIDEO)}=signed; other=1`,
      expected: 'signed',
    },
    {
      scenario: 'another video cookie',
      cookie: `${videoAccessCookieName(SESSION)}=signed`,
      expected: null,
    },
    {
      scenario: 'an overlong cookie',
      cookie: `${videoAccessCookieName(VIDEO)}=${'x'.repeat(129)}`,
      expected: null,
    },
    { scenario: 'no cookie at all', cookie: undefined, expected: null },
  ])('takes the credential from $scenario', ({ cookie, expected }) => {
    const request = requestWith(cookie === undefined ? {} : { cookie });

    expect(videoAccessOf(request, VIDEO, undefined)).toEqual({
      shareToken: null,
      credential: expected,
    });
  });

  it('carries the share token and the session key into the watch request', () => {
    const request = requestWith({ 'x-viewer-session': SESSION });

    expect(watchRequestOf(request, VIDEO, 'tokentokentokentoken01')).toEqual({
      shareToken: 'tokentokentokentoken01',
      credential: null,
      sessionKey: SESSION,
    });
  });
});
