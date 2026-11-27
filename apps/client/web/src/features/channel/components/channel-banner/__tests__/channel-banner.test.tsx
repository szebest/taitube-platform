import { channel } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { AppProviders } from '#app/__tests__/providers';
import { ChannelHeader } from '#app/components/channel/channel-header';
import { ChannelBanner, type ChannelBannerProps } from '../channel-banner';

const variants = (name: string) => ({ '1280': `/${name}-1.webp`, '2560': `/${name}-2.webp` });

const renderBanner = (fields: Partial<ChannelBannerProps['channel']>) =>
  renderPage(
    <ChannelHeader.Root>
      <ChannelBanner channel={{ ...channel(), ...fields }} />
    </ChannelHeader.Root>,
    AppProviders
  );

describe('apps/client/web: ChannelBanner', () => {
  it('serves one picture: the TV and desktop targets by media query, the mobile one as the image', async () => {
    const markup = await renderBanner({
      banner: { desktop: variants('d'), mobile: variants('m'), tv: variants('t') },
    });

    expect(markup).toContain(
      '<source media="(min-width: 1920px)" srcSet="/t-1.webp 1280w, /t-2.webp 2560w"'
    );
    expect(markup).toContain(
      '<source media="(min-width: 600px)" srcSet="/d-1.webp 1280w, /d-2.webp 2560w"'
    );
    expect(markup).toContain('<img src="/m-1.webp" srcSet="/m-1.webp 1280w, /m-2.webp 2560w"');
  });

  it('falls back to the address set earlier when there are no targets', async () => {
    const markup = await renderBanner({ bannerUrl: '/old-banner.png' });

    expect(markup).toContain('src="/old-banner.png"');
    expect(markup).not.toContain('<picture');
  });

  it.each([
    { name: 'an https address', url: 'https://shop.example.com/', shown: true },
    { name: 'an http address', url: 'http://shop.example.com/', shown: false },
    { name: 'a script address', url: 'javascript:alert(1)', shown: false },
  ])('draws the banner link for $name: $shown', async ({ url, shown }) => {
    const markup = await renderBanner({ bannerLink: { label: 'Shop', url } });

    expect(markup.includes('>Shop</a>')).toBe(shown);
  });

  it('opens the banner link in a new tab without handing over the opener, inside the safe area', async () => {
    const markup = await renderBanner({
      bannerLink: { label: 'Shop', url: 'https://shop.example.com/' },
    });

    expect(markup).toContain('href="https://shop.example.com/"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toMatch(/pointer-events-none[^"]*"><a [^>]*>Shop/);
  });

  it('draws no link when the channel has none', async () => {
    expect(await renderBanner({ bannerLink: null })).not.toContain('<a ');
  });
});
