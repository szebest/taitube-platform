import type { LiveStream } from '@vp/domain';
import { toChannelView, toOwnerExtras } from '../channel-views';
import { aChannel, aLiveStream, STREAM_ID, VIDEO_ID } from './live-harness';

const STATS = { videoCount: 1, totalViews: 9 };
const CDN = 'https://cdn.test';

const viewOf = (
  overrides = {},
  localization: Parameters<typeof toChannelView>[3]['localization'] = null
) => toChannelView(aChannel(overrides), STATS, null, { cdn: CDN, localization });
const liveOf = (open: LiveStream | null) =>
  toChannelView(aChannel(), STATS, open, { cdn: CDN }).live;

describe('apps/server/api/services: channel views', () => {
  it('puts a public broadcast on the channel', () => {
    expect(liveOf(aLiveStream())).toEqual({
      liveStreamId: STREAM_ID,
      videoId: VIDEO_ID,
      startedAt: '2026-03-01T12:00:00.000Z',
    });
  });

  it.each([
    { scenario: 'no open stream', open: null },
    {
      scenario: 'an idle stream',
      open: aLiveStream({ status: 'IDLE', videoId: null, startedAt: null }),
    },
    { scenario: 'an unlisted broadcast', open: aLiveStream({ visibility: 'unlisted' }) },
    { scenario: 'a private broadcast', open: aLiveStream({ visibility: 'private' }) },
  ])('shows no live dot for $scenario', ({ open }) => {
    expect(liveOf(open)).toBeNull();
  });

  it('has no uploaded avatar or banner until a version exists', () => {
    expect(viewOf()).toMatchObject({ avatar: null, banner: null });
  });

  it('addresses every avatar size and banner target of the current version', () => {
    const view = viewOf({ id: 'c1', avatarVersion: 2, bannerVersion: 3 });

    expect(view.avatar?.sizes).toEqual({
      '48': `${CDN}/channels/c1/avatar/v2/48.webp`,
      '72': `${CDN}/channels/c1/avatar/v2/72.webp`,
      '128': `${CDN}/channels/c1/avatar/v2/128.webp`,
      '256': `${CDN}/channels/c1/avatar/v2/256.webp`,
    });
    expect(view.banner?.tv).toEqual({
      '1280': `${CDN}/channels/c1/banner/v3/tv-1280.webp`,
      '2560': `${CDN}/channels/c1/banner/v3/tv-2560.webp`,
    });
    expect(Object.keys(view.banner ?? {})).toEqual(['desktop', 'mobile', 'tv']);
  });

  it('reads the platform off each link and keeps the rest of it', () => {
    const links = [
      { label: 'Code', url: 'https://github.com/ada' },
      { label: 'Site', url: 'https://ada.example.com' },
    ];

    expect(viewOf({ links }).links).toEqual([
      { ...links[0], platform: 'github' },
      { ...links[1], platform: 'website' },
    ]);
  });

  it('says a contact exists without ever carrying the address', () => {
    const view = viewOf({ contactEmail: 'ada@example.com' });

    expect(view.hasContact).toBe(true);
    expect(JSON.stringify(view)).not.toContain('ada@example.com');
    expect(viewOf().hasContact).toBe(false);
  });

  it.each([
    {
      scenario: 'the localized text',
      localization: { locale: 'pl', description: 'Opis', trailerVideoId: null },
      expected: 'Opis',
    },
    {
      scenario: 'the default when the row has no text',
      localization: { locale: 'pl', description: null, trailerVideoId: null },
      expected: 'Default',
    },
    { scenario: 'the default without a row', localization: null, expected: 'Default' },
  ])('describes the channel with $scenario', ({ localization, expected }) => {
    expect(viewOf({ bio: 'Default' }, localization).bio).toBe(expected);
  });

  it.each([
    { scenario: 'never changed', changedAt: null, expected: null },
    {
      scenario: 'changed a day ago',
      changedAt: new Date('2026-03-09T00:00:00Z'),
      expected: '2026-04-08T00:00:00.000Z',
    },
    {
      scenario: 'changed 40 days ago',
      changedAt: new Date('2026-01-29T00:00:00Z'),
      expected: null,
    },
  ])('tells the owner when the handle may change: $scenario', ({ changedAt, expected }) => {
    const extras = toOwnerExtras(
      aChannel({ handleChangedAt: changedAt }),
      new Date('2026-03-10T00:00:00Z')
    );

    expect(extras.handleChangeAvailableAt).toBe(expected);
  });
});
