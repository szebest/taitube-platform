import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ThumbsUp } from 'lucide-react';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { IconButton } from '../button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger } from '../tooltip';

function LikeButton() {
  return (
    <TooltipProvider>
      <Tooltip content="I like this">
        <IconButton aria-label="Like">
          <ThumbsUp aria-hidden="true" />
        </IconButton>
      </Tooltip>
    </TooltipProvider>
  );
}

describe('apps/web: Tooltip', () => {
  it('shows on keyboard focus and describes its trigger', async () => {
    render(<LikeButton />);

    await userEvent.tab();

    expect(await screen.findByRole('tooltip')).toHaveTextContent('I like this');
    expect(screen.getByRole('button', { name: 'Like' })).toHaveAccessibleDescription('I like this');
  });

  it('hides on Escape and leaves focus on the trigger', async () => {
    render(<LikeButton />);
    await userEvent.tab();
    await screen.findByRole('tooltip');

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Like' })).toHaveFocus();
  });

  it('composes from its parts for a tooltip the convenience form cannot express', async () => {
    render(
      <TooltipProvider>
        <TooltipRoot open>
          <TooltipTrigger>Views</TooltipTrigger>
          <TooltipContent side="bottom">1,204 views</TooltipContent>
        </TooltipRoot>
      </TooltipProvider>
    );

    expect(await screen.findByRole('tooltip')).toHaveTextContent('1,204 views');
  });

  it.each(THEMES)('passes axe open in the %s theme', async (theme) => {
    render(<LikeButton />);
    await userEvent.tab();
    await screen.findByRole('tooltip');

    expect(await axeViolations(theme)).toEqual([]);
  });
});
