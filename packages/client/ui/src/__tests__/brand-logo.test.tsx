import { renderToStaticMarkup } from 'react-dom/server';

import { BrandLogo } from '../brand-logo';

const NARROW_SCREEN_HIDES = 'tw:max-[400px]:hidden';

describe('@vp/ui: brand logo', () => {
  it('names itself Taitube however much of it shows', () => {
    expect(renderToStaticMarkup(<BrandLogo compact />)).toContain(
      'role="img" aria-label="Taitube"'
    );
  });

  it.each([
    { compact: true, hidesWordmark: true },
    { compact: false, hidesWordmark: false },
  ])(
    'leaves the wordmark off a narrow screen only when compact=$compact',
    ({ compact, hidesWordmark }) => {
      expect(
        renderToStaticMarkup(<BrandLogo compact={compact} />).includes(NARROW_SCREEN_HIDES)
      ).toBe(hidesWordmark);
    }
  );
});
