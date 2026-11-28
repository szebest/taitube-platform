import { expectErr, expectOk } from '@kit/testing/result';
import { standardChannelLayout } from '@vp/domain';
import { selectTab } from '../channel-page/channel-page-view';

const POOL = {
  sections: {},
  filled: { videos: true, shorts: false, posts: false, playlists: false },
};
const NOW = new Date('2026-12-01T12:00:00.000Z');
const viewer = { audience: 'guest' as const, now: NOW, locales: ['en'] };

describe('selectTab', () => {
  it('shows the fixed tabs that have content, Home and About always, in layout order', () => {
    const selection = expectOk(
      selectTab(standardChannelLayout(), POOL, viewer, undefined, 'owner')
    );

    expect(selection.tabs.map(({ kind }) => kind)).toEqual(['home', 'videos', 'about']);
    expect(selection.tab).toMatchObject({ kind: 'home', id: 'home' });
  });

  it('answers a missing tab with not found', () => {
    expect(
      expectErr(selectTab(standardChannelLayout(), POOL, viewer, 'shorts', 'owner')).code
    ).toBe('CHANNEL_NOT_FOUND');
  });
});
