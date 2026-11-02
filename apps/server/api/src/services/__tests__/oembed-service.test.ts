import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { databaseUnavailable, ErrorCodes } from '@vp/errors';
import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { seedVideo } from '../../__tests__/test-app';
import { OEmbedService } from '../oembed-service';
import { TEST_CDN } from './service-deps';

const WEB = 'http://localhost:5173';
const OWNER = '00000000-0000-7000-8000-00000000d001';
const PUBLIC = '00000000-0000-7000-8000-00000000d0b1';
const PRIVATE = '00000000-0000-7000-8000-00000000d0b2';
const ABSENT = '00000000-0000-7000-8000-00000000d0b3';
const query = (id: string, extra: object = {}) => ({
  url: `${WEB}/watch/${id}`,
  format: 'json' as const,
  ...extra,
});

describe('apps/server/api/services: OEmbedService', () => {
  let repositories: InMemoryRepositories;
  let service: OEmbedService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    service = new OEmbedService({
      videos: repositories.videos,
      channels: repositories.channels,
      cdn: TEST_CDN,
      webUrl: WEB,
    });
    await repositories.channels.create({ userId: OWNER, handle: 'owner', displayName: 'Owner' });
    await seedVideo(repositories, {
      id: PUBLIC,
      ownerId: OWNER,
      title: 'Match',
      posterKey: 'p/a.jpg',
    });
    await seedVideo(repositories, { id: PRIVATE, ownerId: OWNER, visibility: 'private' });
  });

  it('describes a public video with its channel, poster and iframe', async () => {
    expect(expectOk(await service.embed(query(PUBLIC)))).toMatchObject({
      title: 'Match',
      author_name: 'Owner',
      thumbnail_url: `${TEST_CDN}/p/a.jpg`,
      width: 640,
      height: 360,
      html: expect.stringContaining(`${WEB}/embed/${PUBLIC}`),
    });
  });

  it('fits the iframe inside maxwidth and maxheight', async () => {
    const embed = expectOk(await service.embed(query(PUBLIC, { maxwidth: 800, maxheight: 90 })));

    expect(embed).toMatchObject({ width: 160, height: 90 });
  });

  it.each([
    { scenario: 'a private video', input: query(PRIVATE), code: ErrorCodes.VIDEO_NOT_FOUND },
    { scenario: 'an absent video', input: query(ABSENT), code: ErrorCodes.VIDEO_NOT_FOUND },
    {
      scenario: 'a page of another site',
      input: { url: `https://elsewhere.test/watch/${PUBLIC}`, format: 'json' as const },
      code: ErrorCodes.OEMBED_URL_UNSUPPORTED,
    },
    {
      scenario: 'the xml format',
      input: query(PUBLIC, { format: 'xml' }),
      code: ErrorCodes.OEMBED_FORMAT_UNSUPPORTED,
    },
  ])('refuses $scenario', async ({ input, code }) => {
    expect(expectErr(await service.embed(input))).toMatchObject({ code });
  });

  it('passes a failing store through', async () => {
    vi.spyOn(repositories.videos, 'findById').mockResolvedValue(err(databaseUnavailable('down')));

    expect(expectErr(await service.embed(query(PUBLIC)))).toMatchObject({
      code: ErrorCodes.DATABASE_UNAVAILABLE,
    });
  });
});
