import { render } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { LiveChatSkeleton } from '../live-chat-skeleton';

const renderSkeleton = () =>
  render(
    <AppProviders>
      <LiveChatSkeleton className="extra" />
    </AppProviders>
  );

describe('apps/client/web: LiveChatSkeleton', () => {
  it('is hidden from assistive tech, takes a class and passes axe', async () => {
    const { container } = renderSkeleton();
    const skeleton = container.querySelector('[data-slot="live-chat-skeleton"]');

    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    expect(skeleton).toHaveClass('extra');
    expect(await axeViolations()).toEqual([]);
  });
});
