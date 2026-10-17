import { render } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentProps } from 'react';

import { Skeleton } from '../skeleton';

function renderSkeleton(props: ComponentProps<typeof Skeleton> = {}) {
  return render(<Skeleton {...props} />);
}

describe('@vp/ui: Skeleton', () => {
  it('is hidden from assistive technology, which waits for the content instead', () => {
    const { container } = renderSkeleton({ className: 'tw:h-4 tw:w-32' });

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('shimmers only for a viewer who has not asked for reduced motion', () => {
    const { container } = renderSkeleton();

    const animations = [...(container.firstElementChild?.classList ?? [])].filter((name) =>
      name.includes('animate-')
    );
    expect(animations).toEqual(['tw:motion-safe:animate-shimmer']);
  });

  it('passes axe', async () => {
    renderSkeleton();

    expect(await axeViolations()).toEqual([]);
  });
});
