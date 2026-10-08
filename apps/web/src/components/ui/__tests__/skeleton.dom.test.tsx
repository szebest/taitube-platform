import { render } from '@testing-library/react';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { Skeleton } from '../skeleton';

describe('apps/web: Skeleton', () => {
  it('is hidden from assistive technology, which waits for the content instead', () => {
    const { container } = render(<Skeleton className="tw:h-4 tw:w-32" />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('shimmers only for a viewer who has not asked for reduced motion', () => {
    const { container } = render(<Skeleton />);

    const animations = [...(container.firstElementChild?.classList ?? [])].filter((name) =>
      name.includes('animate-')
    );
    expect(animations).toEqual(['tw:motion-safe:animate-shimmer']);
  });

  it.each(THEMES)('passes axe in the %s theme', async (theme) => {
    render(<Skeleton />);

    expect(await axeViolations(theme)).toEqual([]);
  });
});
