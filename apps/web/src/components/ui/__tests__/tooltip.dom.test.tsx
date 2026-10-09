import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Share2, ThumbsUp } from 'lucide-react';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { IconButton } from '../button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger } from '../tooltip';

function ActionBar() {
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
    </TooltipProvider>
  );
}

describe('apps/web: Tooltip', () => {
  it('shows on keyboard focus and describes its trigger', async () => {
    render(<ActionBar />);

    await userEvent.tab();

    expect(await screen.findByRole('tooltip')).toHaveTextContent('I like this');
    expect(screen.getByRole('button', { name: 'Like' })).toHaveAccessibleDescription('I like this');
  });

  it('hides on Escape and leaves focus on the trigger', async () => {
    render(<ActionBar />);
    await userEvent.tab();
    await screen.findByRole('tooltip');

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Like' })).toHaveFocus();
  });

  it('opens on hover after a delay, so a pointer passing over does not flash it', async () => {
    render(<ActionBar />);

    await userEvent.hover(screen.getByRole('button', { name: 'Like' }));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('I like this');
  });

  it('opens the next tooltip at once while the shared provider is warm', async () => {
    render(<ActionBar />);
    await userEvent.hover(screen.getByRole('button', { name: 'Like' }));
    await screen.findByRole('tooltip');

    await userEvent.hover(screen.getByRole('button', { name: 'Share video' }));

    expect(screen.getByRole('tooltip')).toHaveTextContent('Share');
  });

  it('places itself on the side it is given', async () => {
    render(<ActionBar />);

    await userEvent.tab();
    await userEvent.tab();

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Share');
    expect(tooltip.closest('[data-slot="tooltip-content"]')).toHaveAttribute('data-side', 'bottom');
  });

  it('composes from its parts for a tooltip the short form cannot express', async () => {
    render(
      <TooltipProvider>
        <TooltipRoot open>
          <TooltipTrigger>Views</TooltipTrigger>
          <TooltipContent align="start">1,204 views</TooltipContent>
        </TooltipRoot>
      </TooltipProvider>
    );

    expect(await screen.findByRole('tooltip')).toHaveTextContent('1,204 views');
    expect(screen.getByRole('button', { name: 'Views' })).toHaveAccessibleDescription(
      '1,204 views'
    );
  });

  it.each(THEMES)('passes axe open in the %s theme', async (theme) => {
    render(<ActionBar />);
    await userEvent.tab();
    await screen.findByRole('tooltip');

    expect(await axeViolations(theme)).toEqual([]);
  });
});
