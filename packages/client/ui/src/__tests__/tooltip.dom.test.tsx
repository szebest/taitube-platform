import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { Share2, ThumbsUp } from 'lucide-react';

import { IconButton } from '../button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger } from '../tooltip';

function ActionBar({
  container,
  composed = false,
}: {
  container?: HTMLElement;
  composed?: boolean;
}) {
  return (
    <TooltipProvider>
      <Tooltip content="I like this">
        <IconButton aria-label="Like">
          <ThumbsUp aria-hidden="true" />
        </IconButton>
      </Tooltip>
      <Tooltip content="Share" side="bottom">
        <IconButton aria-label="Share video">
          <Share2 aria-hidden="true" />
        </IconButton>
      </Tooltip>
      {composed && (
        <TooltipRoot open>
          <TooltipTrigger>Views</TooltipTrigger>
          <TooltipContent align="start" container={container}>
            1,204 views
          </TooltipContent>
        </TooltipRoot>
      )}
    </TooltipProvider>
  );
}

const renderTooltips = (props: Parameters<typeof ActionBar>[0] = {}) =>
  render(<ActionBar {...props} />);

describe('@vp/ui: Tooltip', () => {
  it('shows on keyboard focus and describes its trigger', async () => {
    renderTooltips();

    await userEvent.tab();

    expect(await screen.findByRole('tooltip')).toHaveTextContent('I like this');
    expect(screen.getByRole('button', { name: 'Like' })).toHaveAccessibleDescription('I like this');
  });

  it('hides on Escape and leaves focus on the trigger', async () => {
    renderTooltips();
    await userEvent.tab();
    await screen.findByRole('tooltip');

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Like' })).toHaveFocus();
  });

  it('opens on hover after a delay, so a pointer passing over does not flash it', async () => {
    renderTooltips();

    await userEvent.hover(screen.getByRole('button', { name: 'Like' }));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('I like this');
  });

  it('opens the next tooltip at once while the shared provider is warm', async () => {
    renderTooltips();
    await userEvent.hover(screen.getByRole('button', { name: 'Like' }));
    await screen.findByRole('tooltip');

    await userEvent.hover(screen.getByRole('button', { name: 'Share video' }));

    expect(screen.getByRole('tooltip')).toHaveTextContent('Share');
  });

  it('places itself on the side it is given', async () => {
    renderTooltips();

    await userEvent.tab();
    await userEvent.tab();

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Share');
    expect(tooltip.closest('[data-slot="tooltip-content"]')).toHaveAttribute('data-side', 'bottom');
  });

  it('composes from its parts for a tooltip the short form cannot express', async () => {
    renderTooltips({ composed: true });

    expect(await screen.findByRole('tooltip')).toHaveTextContent('1,204 views');
    expect(screen.getByRole('button', { name: 'Views' })).toHaveAccessibleDescription(
      '1,204 views'
    );
  });

  it('renders inside the container it is given', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    renderTooltips({ composed: true, container });

    expect(container).toContainElement(await screen.findByRole('tooltip'));
  });

  it('passes axe open', async () => {
    renderTooltips();
    await userEvent.tab();
    await screen.findByRole('tooltip');

    expect(await axeViolations()).toEqual([]);
  });
});
