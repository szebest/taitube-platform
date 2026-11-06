import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { Button } from '../../button';
import { Popover } from '..';
import type { PopoverSize } from '../types';

const renderSharePopover = (size?: PopoverSize, container?: HTMLElement) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button>Share</Button>
        </Popover.Trigger>
        <Popover.Content size={size} container={container} aria-label="Share video">
          <Popover.Arrow />
          <a href="/watch/lisbon">Copy link</a>
          <Popover.Close asChild>
            <Button>Done</Button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Root>
    ),
  };
};

describe('@vp/ui: Popover', () => {
  it.each([
    { size: 'sm', width: 'w-60' },
    { size: 'md', width: 'w-80' },
    { size: 'lg', width: 'w-100' },
  ] as const)('opens a named dialog at size $size from its trigger', async ({ size, width }) => {
    const { user } = renderSharePopover(size);
    const trigger = screen.getByRole('button', { name: 'Share' });

    await user.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Share video' })).toHaveClass(width);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it.each([
    {
      how: 'Escape',
      close: (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}'),
    },
    {
      how: 'its close action',
      close: (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'Done' })),
    },
  ])('closes on $how and hands focus back to the trigger', async ({ close }) => {
    const { user } = renderSharePopover();
    await user.click(screen.getByRole('button', { name: 'Share' }));

    await close(user);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toHaveFocus();
  });

  it('passes axe open', async () => {
    const { user } = renderSharePopover();
    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(await axeViolations()).toEqual([]);
  });

  it('opens inside the container it is handed, as a player that went fullscreen needs', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const { user } = renderSharePopover('sm', container);

    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(container).toContainElement(screen.getByRole('dialog', { name: 'Share video' }));
    container.remove();
  });
});
