import { render } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { Skeleton, type SkeletonProps } from '../skeleton';

function renderSkeleton(props: SkeletonProps = {}) {
  const { container } = render(<Skeleton className="h-4 w-32" {...props} />);
  return container.firstElementChild;
}

describe('@vp/ui: Skeleton', () => {
  it('is hidden from assistive technology, which waits for the content instead', () => {
    expect(renderSkeleton()).toHaveAttribute('aria-hidden', 'true');
  });

  it('shimmers only for a viewer who has not asked for reduced motion', () => {
    const animations = [...(renderSkeleton()?.classList ?? [])].filter((name) =>
      name.includes('animate-')
    );

    expect(animations).toEqual(['motion-safe:animate-shimmer']);
  });

  it.each([
    { shape: 'rect', radius: 'card', corner: 'rounded-card' },
    { shape: 'circle', radius: 'card', corner: 'rounded-full' },
    { shape: 'text', radius: undefined, corner: 'rounded-xs' },
  ] as const)('rounds a $shape at $corner', ({ shape, radius, corner }) => {
    const rounding = [...(renderSkeleton({ shape, radius })?.classList ?? [])].filter((name) =>
      name.startsWith('rounded-')
    );

    expect(rounding).toEqual([corner]);
  });

  it('passes axe', async () => {
    renderSkeleton();

    expect(await axeViolations()).toEqual([]);
  });
});
