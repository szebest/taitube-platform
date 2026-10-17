import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { BrandLogo } from '../brand-logo';

const NARROW_SCREEN_HIDES = 'tw:max-[400px]:hidden';

function renderBrandLogo(props: ComponentProps<typeof BrandLogo> = {}): string {
  return renderToStaticMarkup(<BrandLogo {...props} />);
}

describe('@vp/ui: brand logo', () => {
  it('names itself Taitube however much of it shows', () => {
    expect(renderBrandLogo({ compact: true })).toContain('role="img" aria-label="Taitube"');
  });

  it.each([
    { compact: true, hidesWordmark: true },
    { compact: false, hidesWordmark: false },
  ])(
    'leaves the wordmark off a narrow screen only when compact=$compact',
    ({ compact, hidesWordmark }) => {
      expect(renderBrandLogo({ compact }).includes(NARROW_SCREEN_HIDES)).toBe(hidesWordmark);
    }
  );
});
