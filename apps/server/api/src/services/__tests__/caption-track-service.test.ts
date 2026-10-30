import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { MAX_CAPTION_TRACKS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { captionsFileKey } from '@vp/storage';
import { expectErr, expectOk } from '@vp/testing/result';
import { CaptionTrackService } from '../caption-track-service';
import {
  CAPTION_OWNER,
  CAPTION_STRANGER,
  CAPTIONED,
  PRIVATE_CAPTIONED,
  seedCaptionVideos,
  seedTrack,
  VTT,
} from './caption-fixture';
import { TEST_CDN } from './service-deps';

const PUBLIC = 'public';
const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'pl', 'pt', 'nl', 'sv', 'ja'];

describe('CaptionTrackService', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let service: CaptionTrackService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    service = new CaptionTrackService({
      videos: repositories.videos,
      captions: repositories.captions,
      storage,
      publicBucket: PUBLIC,
      cdn: TEST_CDN,
    });
    await seedCaptionVideos(repositories);
  });

  async function published(language: string) {
    const key = captionsFileKey(CAPTIONED, language);
    return {
      text: expectOk(await storage.getObject(PUBLIC, key)).toString(),
      head: expectOk(await storage.headObject(PUBLIC, key)),
    };
  }

  it('stores an uploaded file as a ready track and publishes it as short-lived WebVTT', async () => {
    const track = expectOk(await service.upload(CAPTION_OWNER, CAPTIONED, 'en-us', VTT));

    expect(track).toMatchObject({
      language: 'en-US',
      kind: 'uploaded',
      status: 'ready',
      url: `${TEST_CDN}/videos/${CAPTIONED}/captions/en-US/captions.vtt`,
    });
    const { text, head } = await published('en-US');
    expect(text).toContain('Hello there');
    expect(head).toMatchObject({ contentType: 'text/vtt', cacheControl: 'public, max-age=60' });
  });

  it('names the line a malformed file breaks on', async () => {
    const broken = 'WEBVTT\n\n00:00.000 --> 00:01.000\nfine\n\nnot a timing line\nhello\n';

    expect(expectErr(await service.upload(CAPTION_OWNER, CAPTIONED, 'en', broken))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'body',
      line: 6,
    });
  });

  it('refuses a new language past the track limit and still replaces one it holds', async () => {
    expect(LANGUAGES).toHaveLength(MAX_CAPTION_TRACKS);
    for (const language of LANGUAGES) {
      expectOk(await service.upload(CAPTION_OWNER, CAPTIONED, language, VTT));
    }

    expect(expectErr(await service.upload(CAPTION_OWNER, CAPTIONED, 'ko', VTT)).code).toBe(
      ErrorCodes.CAPTION_TRACK_LIMIT
    );
    expectOk(await service.upload(CAPTION_OWNER, CAPTIONED, 'en', VTT));
  });

  it.each([
    { who: 'a stranger on a video they can see', videoId: CAPTIONED, readable: true },
    { who: 'a stranger on a private video', videoId: PRIVATE_CAPTIONED, readable: false },
  ])('refuses $who', async ({ videoId, readable }) => {
    expect(expectErr(await service.upload(CAPTION_STRANGER, videoId, 'en', VTT))).toMatchObject({
      code: ErrorCodes.FORBIDDEN,
      readable,
    });
  });

  it('corrects cue text, turns a generated track edited and republishes it', async () => {
    const auto = await seedTrack(repositories, {
      id: '00000000-0000-7000-8000-00000000cc01',
      kind: 'auto',
    });

    const edited = expectOk(
      await service.editCues(CAPTION_OWNER, CAPTIONED, 'en', {
        version: auto.version,
        cues: [{ index: 1, text: 'Today we bake rye' }],
      })
    );

    expect(edited).toMatchObject({ kind: 'edited', version: auto.version + 1 });
    expect((await published('en')).text).toContain('Today we bake rye');
  });

  it.each([
    { name: 'a stale version', lang: 'en', version: 1, code: ErrorCodes.VERSION_CONFLICT },
    {
      name: 'a language with no track',
      lang: 'fr',
      version: 2,
      code: ErrorCodes.CAPTION_NOT_FOUND,
    },
  ])('refuses a cue edit on $name', async ({ lang, version, code }) => {
    await seedTrack(repositories, { id: '00000000-0000-7000-8000-00000000cc02', kind: 'auto' });

    const refused = expectErr(
      await service.editCues(CAPTION_OWNER, CAPTIONED, lang, {
        version,
        cues: [{ index: 0, text: 'x' }],
      })
    );

    expect(refused.code).toBe(code);
  });

  it('deletes the track and its file', async () => {
    expectOk(await service.upload(CAPTION_OWNER, CAPTIONED, 'de', VTT));

    expectOk(await service.remove(CAPTION_OWNER, CAPTIONED, 'de'));

    expect(expectOk(await repositories.captions.list(CAPTIONED))).toEqual([]);
    expect(expectOk(await storage.headObject(PUBLIC, captionsFileKey(CAPTIONED, 'de')))).toBeNull();
  });
});
