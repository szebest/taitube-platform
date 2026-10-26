import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { HoverCard } from '..';
import type { HoverCardSize } from '../types';

const renderChannelLink = (size?: HoverCardSize) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <HoverCard.Root>
        <HoverCard.Trigger asChild>
          <a href="/channel/marta">@marta-reis</a>
        </HoverCard.Trigger>
        <HoverCard.Content size={size}>
          <HoverCard.Arrow />
          Marta Reis Films, 284K followers
        </HoverCard.Content>
      </HoverCard.Root>
    ),
  };
};

describe('@vp/ui: HoverCard', () => {
  it.each([
    { size: 'sm', width: 'tw:w-70' },
    { size: 'md', width: 'tw:w-90' },
  ] as const)(
    'previews the link on hover at size $size, after its delay',
    async ({ size, width }) => {
      const { user } = renderChannelLink(size);

      await user.hover(screen.getByRole('link', { name: '@marta-reis' }));

      expect(screen.queryByText(/284K followers/)).not.toBeInTheDocument();
      expect(await screen.findByText(/284K followers/)).toHaveClass(width);
    }
  );

  it('opens on keyboard focus and closes on Escape, leaving the link a link', async () => {
    const { user } = renderChannelLink();

    await user.tab();
    expect(await screen.findByText(/284K followers/)).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.queryByText(/284K followers/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '@marta-reis' })).toHaveAttribute(
      'href',
      '/channel/marta'
    );
  });

  it('passes axe open', async () => {
    const { user } = renderChannelLink();
    await user.tab();
    await screen.findByText(/284K followers/);

    expect(await axeViolations()).toEqual([]);
  });
});
