import { bannerSources } from '../banner-sources';

const variants = (name: string) => ({
  '1280': `/${name}-1280.webp`,
  '2560': `/${name}-2560.webp`,
});

describe('apps/client/web: bannerSources', () => {
  it('answers the TV target from 1920 px, the desktop one from 600 px and the mobile one below', () => {
    const banner = { desktop: variants('d'), mobile: variants('m'), tv: variants('t') };

    expect(bannerSources(banner)).toEqual({
      sources: [
        { media: '(min-width: 1920px)', srcSet: '/t-1280.webp 1280w, /t-2560.webp 2560w' },
        { media: '(min-width: 600px)', srcSet: '/d-1280.webp 1280w, /d-2560.webp 2560w' },
      ],
      image: { src: '/m-1280.webp', srcSet: '/m-1280.webp 1280w, /m-2560.webp 2560w' },
    });
  });
});
