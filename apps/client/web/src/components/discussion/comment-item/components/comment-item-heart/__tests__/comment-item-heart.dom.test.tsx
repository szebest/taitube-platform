import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { CommentItemHeart, type CommentItemHeartProps } from '../comment-item-heart';

const renderHeart = ({ hearted = false, onToggle }: Partial<CommentItemHeartProps> = {}) =>
  render(
    <AppProviders>
      <CommentItemHeart hearted={hearted} onToggle={onToggle} />
    </AppProviders>
  );

describe('apps/client/web: CommentItemHeart', () => {
  it.each([
    { hearted: false, next: true },
    { hearted: true, next: false },
  ])('gives the owner a toggle pressed $hearted that asks for $next', async ({ hearted, next }) => {
    const onToggle = vi.fn();
    renderHeart({ hearted, onToggle });

    const toggle = screen.getByRole('button', { name: 'Heart' });
    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', String(hearted));
    expect(onToggle).toHaveBeenCalledWith(next);
  });

  it.each([
    { hearted: true, shown: 1 },
    { hearted: false, shown: 0 },
  ])('shows everyone else the heart only once given: hearted $hearted', ({ hearted, shown }) => {
    renderHeart({ hearted });

    expect(screen.queryAllByRole('img', { name: 'Hearted by the creator' })).toHaveLength(shown);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
