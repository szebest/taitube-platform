import { axeViolations } from '@kit/web-testing/dom';
import { render } from '@testing-library/react';
import { ChannelHeaderSkeleton } from '..';

describe('apps/client/web: ChannelHeaderSkeleton', () => {
  it.each([
    { layout: 'full' as const, bars: 7 },
    { layout: 'identity' as const, bars: 5 },
  ])(
    'draws $bars placeholders in the $layout layout, hidden from assistive tech',
    ({ layout, bars }) => {
      render(<ChannelHeaderSkeleton layout={layout} />);

      expect(document.querySelector('[data-slot="channel-header-skeleton"]')).toHaveAttribute(
        'aria-hidden',
        'true'
      );
      expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(bars);
    }
  );

  it('passes axe', async () => {
    render(<ChannelHeaderSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
