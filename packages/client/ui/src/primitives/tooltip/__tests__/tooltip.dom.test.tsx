import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { Direction } from 'radix-ui';
import { Tooltip } from '..';
import { Icon } from '../../icon';
import { IconButton } from '../../icon-button';
import { Kbd } from '../../kbd';
import type { TooltipContentProps } from '../tooltip';

let container: HTMLElement;

beforeEach(() => {
  container = document.body.appendChild(document.createElement('div'));
});

afterEach(() => {
  container.remove();
});

function renderActionBar({
  dir = 'ltr',
  ...share
}: Partial<TooltipContentProps> & { dir?: 'ltr' | 'rtl' } = {}) {
  return render(
    <Direction.Provider dir={dir}>
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <IconButton aria-label="Like">
              <Icon name="like" />
            </IconButton>
          </Tooltip.Trigger>
          <Tooltip.Content>
            I like this <Kbd>L</Kbd>
          </Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <IconButton aria-label="Share video">
              <Icon name="share" />
            </IconButton>
          </Tooltip.Trigger>
          <Tooltip.Content {...share}>Share</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    </Direction.Provider>
  );
}

describe('@vp/ui: Tooltip', () => {
  it('shows on keyboard focus and describes its trigger', async () => {
    renderActionBar();

    await userEvent.tab();

    expect(await screen.findByRole('tooltip')).toHaveTextContent('I like this L');
    expect(screen.getByRole('button', { name: 'Like' })).toHaveAccessibleDescription(
      'I like this L'
    );
  });

  it('hides on Escape and leaves focus on the trigger', async () => {
    renderActionBar();
    await userEvent.tab();
    await screen.findByRole('tooltip');

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Like' })).toHaveFocus();
  });

  it('opens on hover after a delay, and the next one at once while the provider is warm', async () => {
    renderActionBar();

    await userEvent.hover(screen.getByRole('button', { name: 'Like' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await screen.findByRole('tooltip');
    await userEvent.hover(screen.getByRole('button', { name: 'Share video' }));

    expect(screen.getByRole('tooltip')).toHaveTextContent('Share');
  });

  it.each([
    { side: 'block-start', dir: 'ltr', physical: 'top' },
    { side: 'block-end', dir: 'ltr', physical: 'bottom' },
    { side: 'inline-start', dir: 'rtl', physical: 'right' },
  ] as const)(
    'places a $side tooltip on the $physical edge reading $dir',
    async ({ side, dir, physical }) => {
      renderActionBar({ side, dir });

      await userEvent.tab();
      await userEvent.tab();

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip.closest('[data-slot="tooltip-content"]')).toHaveAttribute(
        'data-side',
        physical
      );
    }
  );

  it('renders inside the container it is given', async () => {
    renderActionBar({ container });

    await userEvent.tab();
    await userEvent.tab();

    expect(container).toContainElement(await screen.findByRole('tooltip'));
  });

  it('passes axe open', async () => {
    renderActionBar();
    await userEvent.tab();
    await screen.findByRole('tooltip');

    expect(await axeViolations()).toEqual([]);
  });
});
