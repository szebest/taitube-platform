import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { ChannelSpotlightSettings } from '@vp/api-contracts';
import type { ActingChannel } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { ChannelIdentityService } from '../channel-identity-service';
import { ChannelSpotlightService } from '../channel-spotlight-service';
import { VideoService } from '../video-service';
import { channelIdentityServiceDeps, ownerActing, videoServiceDeps } from './service-deps';

const OWNER_ID = '018f0000-0000-7000-8000-000000000001';
const FAN_ID = '018f0000-0000-7000-8000-000000000003';
const OTHER_OWNER_ID = '018f0000-0000-7000-8000-000000000005';
const CHANNEL_ID = '018f0000-0000-7000-8000-000000000002';
const TRAILER = '018f0000-0000-7000-8000-0000000000a1';
const RETURNING = '018f0000-0000-7000-8000-0000000000a2';
const PRIVATE = '018f0000-0000-7000-8000-0000000000a3';
const PROCESSING = '018f0000-0000-7000-8000-0000000000a4';
const FOREIGN = '018f0000-0000-7000-8000-0000000000a5';
const LOCALIZED = '018f0000-0000-7000-8000-0000000000a6';
const OWNER: UserContext = { id: OWNER_ID, role: 'CREATOR' };
const FAN: UserContext = { id: FAN_ID, role: 'USER' };
const MEMBER: UserContext = { id: '018f0000-0000-7000-8000-000000000009', role: 'CREATOR' };
const ACTING = ownerActing(OWNER_ID, CHANNEL_ID);
const MODERATOR: ActingChannel = { channelId: CHANNEL_ID, ownerId: OWNER_ID, role: 'moderator' };
const NOTHING: ChannelSpotlightSettings = {
  trailerVideoId: null,
  returningVideoId: null,
  localizations: [],
};

describe('ChannelSpotlightService', () => {
  let repositories: InMemoryRepositories;
  let service: ChannelSpotlightService;

  const sourceOf = async (viewer: UserContext | null, locales = ['en']) =>
    expectOk(await service.get(viewer, '@owner', locales)).source;
  const idOf = async (viewer: UserContext | null, locales = ['en']) =>
    expectOk(await service.get(viewer, '@owner', locales)).video?.id ?? null;
  const replace = (input: Partial<ChannelSpotlightSettings>, acting = ACTING, user = OWNER) =>
    service.replace(user, acting, { ...NOTHING, ...input });

  async function video(id: string, ownerId: string, overrides = {}) {
    expectOk(
      await repositories.videos.create({
        id,
        ownerId,
        title: `Video ${id.slice(-2)}`,
        visibility: 'public',
        status: 'READY',
        sourceKey: `raw/${id}.mp4`,
        ...overrides,
      })
    );
  }

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    repositories.clear();
    const identity = new ChannelIdentityService(channelIdentityServiceDeps(repositories));
    service = new ChannelSpotlightService({
      channels: repositories.channels,
      pages: repositories.channelPages,
      videos: repositories.videos,
      subscriptions: repositories.subscriptions,
      audit: repositories.channelAudit,
      identity,
      videoService: new VideoService(
        videoServiceDeps(repositories.videos, { channels: repositories.channels })
      ),
      locales: ['en', 'pl'],
    });
    for (const id of [OWNER_ID, FAN_ID, OTHER_OWNER_ID]) {
      expectOk(await repositories.users.upsert({ id, email: `${id}@example.com`, tier: 'free' }));
    }
    expectOk(
      await repositories.channels.create({
        id: CHANNEL_ID,
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'Owner',
      })
    );
    await video(TRAILER, OWNER_ID);
    await video(RETURNING, OWNER_ID);
    await video(LOCALIZED, OWNER_ID);
    await video(PRIVATE, OWNER_ID, { visibility: 'private' });
    await video(PROCESSING, OWNER_ID, { status: 'PROCESSING' });
    await video(FOREIGN, OTHER_OWNER_ID);
  });

  describe('replace and getSettings', () => {
    it('stores the slots and the localizations, and reads them back as saved', async () => {
      const settings = {
        trailerVideoId: TRAILER,
        returningVideoId: RETURNING,
        localizations: [{ locale: 'pl', description: 'Opis', trailerVideoId: LOCALIZED }],
      };

      expect(expectOk(await replace(settings))).toEqual(settings);
      expect(expectOk(await service.getSettings(OWNER, ACTING))).toEqual(settings);
    });

    it('audits the change', async () => {
      expectOk(await replace({ trailerVideoId: TRAILER }));

      const rows = expectOk(
        await repositories.channelAudit.list(CHANNEL_ID, { cursor: null, limit: 10 })
      );
      expect(rows).toMatchObject([{ action: 'channel.updated', meta: { fields: ['spotlight'] } }]);
    });

    it.each([
      { scenario: 'a private video', input: { trailerVideoId: PRIVATE } },
      { scenario: 'a video still processing', input: { returningVideoId: PROCESSING } },
      { scenario: "another channel's video", input: { trailerVideoId: FOREIGN } },
      {
        scenario: 'a localized trailer that is not the channel own',
        input: { localizations: [{ locale: 'pl', description: null, trailerVideoId: FOREIGN }] },
      },
    ])('refuses $scenario with INVALID_SPOTLIGHT_VIDEO', async ({ input }) => {
      expect(expectErr(await replace(input)).code).toBe(ErrorCodes.INVALID_SPOTLIGHT_VIDEO);
    });

    it.each([
      { scenario: 'a locale the app has no translation for', locale: 'xx', twice: false },
      { scenario: 'a locale given twice', locale: 'pl', twice: true },
    ])('refuses $scenario', async ({ locale, twice }) => {
      const row = { locale, description: 'x', trailerVideoId: null };

      const failure = expectErr(await replace({ localizations: twice ? [row, row] : [row] }));

      expect(failure.code).toBe(ErrorCodes.VALIDATION_FAILED);
    });

    it('refuses a role that may not edit the channel, on both reads and writes', async () => {
      expect(expectErr(await replace({}, MODERATOR, MEMBER)).code).toBe(ErrorCodes.FORBIDDEN);
      expect(expectErr(await service.getSettings(MEMBER, MODERATOR)).code).toBe(
        ErrorCodes.FORBIDDEN
      );
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      expectOk(await replace({ trailerVideoId: TRAILER, returningVideoId: RETURNING }));
    });

    it('shows a visitor the trailer', async () => {
      expect(await sourceOf(null)).toBe('trailer');
      expect(await idOf(null)).toBe(TRAILER);
    });

    it('shows a signed-in non-subscriber the trailer too', async () => {
      expect(await idOf(FAN)).toBe(TRAILER);
    });

    it('shows a subscriber the returning-subscriber video', async () => {
      expectOk(await repositories.subscriptions.subscribe(FAN_ID, CHANNEL_ID));

      expect(await sourceOf(FAN)).toBe('returning');
      expect(await idOf(FAN)).toBe(RETURNING);
    });

    it('falls back to the trailer for a subscriber when no returning video is set', async () => {
      expectOk(await replace({ trailerVideoId: TRAILER }));
      expectOk(await repositories.subscriptions.subscribe(FAN_ID, CHANNEL_ID));

      expect(await sourceOf(FAN)).toBe('trailer');
    });

    it('prefers the trailer of the negotiated locale, and the default for a locale with none', async () => {
      expectOk(
        await replace({
          trailerVideoId: TRAILER,
          localizations: [{ locale: 'pl', description: null, trailerVideoId: LOCALIZED }],
        })
      );

      expect(await idOf(null, ['pl-PL', 'pl', 'en'])).toBe(LOCALIZED);
      expect(await idOf(null, ['de', 'en'])).toBe(TRAILER);
    });

    it('drops a trailer that turned private without a save', async () => {
      const trailer = expectOk(await repositories.videos.findById(TRAILER));
      Object.assign(trailer ?? {}, { visibility: 'private' });

      expect(await sourceOf(null)).toBeNull();
      expect(await idOf(null)).toBeNull();
    });

    it('shows nothing when nothing is set', async () => {
      expectOk(await replace({}));

      expect(await sourceOf(null)).toBeNull();
    });

    it('answers CHANNEL_NOT_FOUND for a channel that is not there', async () => {
      expect(expectErr(await service.get(null, '@nobody', ['en'])).code).toBe(
        ErrorCodes.CHANNEL_NOT_FOUND
      );
    });
  });
});
