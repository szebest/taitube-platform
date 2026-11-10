import type { Channel } from '@vp/api-contracts';

type Banner = NonNullable<Channel['banner']>;
type Variants = Banner[keyof Banner];

interface BannerSource {
  media: string;
  srcSet: string;
}

export interface BannerSources {
  /** Widest first, so the first query that matches wins. */
  sources: BannerSource[];
  /** The `img` itself, which answers every width the sources do not. */
  image: { src: string; srcSet: string };
}

const TV_MIN_WIDTH = '1920px';
const DESKTOP_MIN_WIDTH = '600px';

function srcSetOf(variants: Variants): string {
  return `${variants['1280']} 1280w, ${variants['2560']} 2560w`;
}

/** The banner target for each width: `tv` from the xlarge breakpoint, `desktop` from medium, `mobile` below. */
export function bannerSources(banner: Banner): BannerSources {
  return {
    sources: [
      { media: `(min-width: ${TV_MIN_WIDTH})`, srcSet: srcSetOf(banner.tv) },
      { media: `(min-width: ${DESKTOP_MIN_WIDTH})`, srcSet: srcSetOf(banner.desktop) },
    ],
    image: { src: banner.mobile['1280'], srcSet: srcSetOf(banner.mobile) },
  };
}
