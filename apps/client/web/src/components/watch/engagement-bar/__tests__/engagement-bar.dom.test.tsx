import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DropdownMenu } from '@vp/ui';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { EngagementBar, EngagementBarSkeleton, type EngagementBarReaction } from '..';

interface BarProps {
  reaction?: EngagementBarReaction;
  likes?: string;
  subscribed?: boolean;
  pending?: boolean;
  onReact?: (next: EngagementBarReaction) => void;
  onToggle?: () => void;
}

const renderBar = ({
  reaction = null,
  likes = '24K',
  subscribed = false,
  pending = false,
  onReact = vi.fn(),
  onToggle = vi.fn(),
}: BarProps = {}) =>
  render(
    <AppProviders>
      <EngagementBar.Root>
        <EngagementBar.Channel name="Marta Reis Films" subscribers="284K subscribers" asChild>
          {/* biome-ignore lint/a11y/useAnchorContent: the kit draws the content into the link */}
          <a href="/channel/marta" />
        </EngagementBar.Channel>
        <EngagementBar.Subscribe subscribed={subscribed} pending={pending} onToggle={onToggle}>
          {subscribed ? 'Subscribed' : 'Subscribe'}
        </EngagementBar.Subscribe>
        <EngagementBar.Actions>
          <EngagementBar.Reaction value={reaction} likes={likes} onChange={onReact} />
          <EngagementBar.Action icon="share">Share</EngagementBar.Action>
          <EngagementBar.Action icon="save" pressed>
            Saved
          </EngagementBar.Action>
          <EngagementBar.Overflow>
            <DropdownMenu.Item>Clip</DropdownMenu.Item>
          </EngagementBar.Overflow>
        </EngagementBar.Actions>
      </EngagementBar.Root>
    </AppProviders>
  );

describe('apps/client/web: EngagementBar', () => {
  it('links the channel with its name and count, outside the toolbar', () => {
    renderBar();

    const channel = screen.getByRole('link', { name: /Marta Reis Films/ });

    expect(channel).toHaveAttribute('href', '/channel/marta');
    expect(channel).toHaveTextContent('284K subscribers');
    expect(screen.getByRole('toolbar', { name: 'Video actions' })).not.toContainElement(channel);
  });

  it.each([
    { value: null, press: 'Like 24K', next: 'LIKE' },
    { value: 'LIKE' as const, press: 'Like 24K', next: null },
    { value: 'LIKE' as const, press: 'Dislike', next: 'DISLIKE' },
    { value: 'DISLIKE' as const, press: 'Dislike', next: null },
  ])('asks for $next when $press is pressed holding $value', async ({ value, press, next }) => {
    const onReact = vi.fn();
    renderBar({ reaction: value, onReact });

    await userEvent.click(screen.getByRole('button', { name: press }));

    expect(onReact).toHaveBeenCalledWith(next);
  });

  it('marks the held reaction and the saved action as pressed', () => {
    renderBar({ reaction: 'LIKE' });

    expect(screen.getByRole('button', { name: 'Like 24K' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Dislike' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([
    { subscribed: false, label: 'Subscribe', pressed: 'false' },
    { subscribed: true, label: 'Subscribed', pressed: 'true' },
  ])('shows subscribe as a toggle, pressed $pressed', async ({ subscribed, label, pressed }) => {
    const onToggle = vi.fn();
    renderBar({ subscribed, onToggle });

    const button = screen.getByRole('button', { name: label });
    await userEvent.click(button);

    expect(button).toHaveAttribute('aria-pressed', pressed);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('ignores a second press while the subscription is pending', async () => {
    const onToggle = vi.fn();
    renderBar({ subscribed: true, pending: true, onToggle });

    await userEvent.click(screen.getByRole('button', { name: /Subscribed/ }));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('moves between the actions with the arrow keys', async () => {
    renderBar();
    screen.getByRole('button', { name: 'Like 24K' }).focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Dislike' })).toHaveFocus();

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus();
  });

  it('opens the overflow menu with the actions that do not fit', async () => {
    renderBar();

    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));

    expect(await screen.findByRole('menuitem', { name: 'Clip' })).toBeInTheDocument();
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderBar({ subscribed: true, reaction: 'LIKE' });
    render(<EngagementBarSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
