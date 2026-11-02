import { ErrorCodes } from '@vp/errors';
import {
  buildLibraryApp,
  type LibraryApp,
  PRIVATE_VIDEO,
  VIDEOS,
} from '../../__tests__/library-app';

const WEB = 'http://localhost:5173';
const watch = (id: string) => encodeURIComponent(`${WEB}/watch/${id}?t=30`);

describe('oEmbed route', () => {
  let ctx: LibraryApp;

  beforeEach(async () => {
    ctx = await buildLibraryApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('answers anyone with the video embed of a public watch page', async () => {
    const res = await ctx.call('anonymous', 'GET', `/v1/oembed?url=${watch(VIDEOS[0])}`);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      type: 'video',
      version: '1.0',
      title: 'Clip 0',
      author_name: 'Creator',
      provider_url: WEB,
      width: 640,
      height: 360,
      html: expect.stringContaining(`src="${WEB}/embed/${VIDEOS[0]}"`),
    });
  });

  it('fits the embed inside maxwidth', async () => {
    const res = await ctx.call(
      'anonymous',
      'GET',
      `/v1/oembed?url=${watch(VIDEOS[0])}&maxwidth=320`
    );

    expect(res.json()).toMatchObject({ width: 320, height: 180 });
  });

  it.each([
    {
      scenario: 'a private video',
      query: () => `url=${watch(PRIVATE_VIDEO)}`,
      status: 404,
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      scenario: 'a page of another site',
      query: () => `url=${encodeURIComponent(`https://elsewhere.test/watch/${VIDEOS[0]}`)}`,
      status: 400,
      code: ErrorCodes.OEMBED_URL_UNSUPPORTED,
    },
    {
      scenario: 'the xml format',
      query: () => `url=${watch(VIDEOS[0])}&format=xml`,
      status: 501,
      code: ErrorCodes.OEMBED_FORMAT_UNSUPPORTED,
    },
    {
      scenario: 'a missing url',
      query: () => 'format=json',
      status: 400,
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses $scenario with $status', async ({ query, status, code }) => {
    const res = await ctx.call('anonymous', 'GET', `/v1/oembed?${query()}`);

    expect(res.statusCode).toBe(status);
    expect(res.json()).toMatchObject({ code });
  });
});
