import { LINK_PLATFORMS, type LinkPlatform, platformOfUrl } from '../link-platforms';

describe('@vp/domain: link platforms', () => {
  it.each<[string, LinkPlatform]>([
    ['https://github.com/ada', 'github'],
    ['https://www.github.com/ada', 'github'],
    ['https://gist.github.com/ada', 'github'],
    ['https://x.com/ada', 'x'],
    ['https://twitter.com/ada', 'x'],
    ['https://instagram.com/ada', 'instagram'],
    ['https://www.tiktok.com/@ada', 'tiktok'],
    ['https://twitch.tv/ada', 'twitch'],
    ['https://discord.gg/abc', 'discord'],
    ['https://discord.com/invite/abc', 'discord'],
    ['https://fosstodon.org/@ada', 'mastodon'],
    ['https://bsky.app/profile/ada', 'bluesky'],
    ['https://www.linkedin.com/in/ada', 'linkedin'],
    ['https://reddit.com/u/ada', 'reddit'],
    ['https://fb.com/ada', 'facebook'],
    ['https://ada.example.com', 'website'],
    ['https://notgithub.com/ada', 'website'],
    ['https://github.com.evil.example/ada', 'website'],
    ['not a url', 'website'],
  ])('reads %s as %s', (url, platform) => {
    expect(platformOfUrl(url)).toBe(platform);
  });

  it('lists every platform once, the website first', () => {
    expect(new Set(LINK_PLATFORMS).size).toBe(LINK_PLATFORMS.length);
    expect(LINK_PLATFORMS[0]).toBe('website');
  });
});
