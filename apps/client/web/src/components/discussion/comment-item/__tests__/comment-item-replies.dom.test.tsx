import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { AppProviders } from '#app/__tests__/providers';
import { CommentItemRoot } from '../comment-item';
import { CommentItemReplies } from '../comment-item-replies';
import type { CommentLevel } from '../types';

const renderReplies = ({
  level = 'comment',
  expanded = false,
  onToggle = vi.fn(),
}: {
  level?: CommentLevel;
  expanded?: boolean;
  onToggle?: () => void;
} = {}) =>
  render(
    <AppProviders>
      <CommentItemRoot level={level}>
        <CommentItemReplies count="3" expanded={expanded} onToggle={onToggle}>
          <span>first</span>
          <span>second</span>
        </CommentItemReplies>
      </CommentItemRoot>
    </AppProviders>
  );

describe('apps/client/web: CommentItemReplies', () => {
  it.each([
    { expanded: false, name: 'View 3 replies', items: 0 },
    { expanded: true, name: 'Hide replies', items: 2 },
  ])('names the toggle "$name" and renders $items replies', ({ expanded, name, items }) => {
    renderReplies({ expanded });

    expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded', String(expanded));
    expect(screen.queryAllByRole('listitem')).toHaveLength(items);
  });

  it('asks to toggle on click', async () => {
    const onToggle = vi.fn();
    renderReplies({ onToggle });

    await userEvent.click(screen.getByRole('button'));

    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('renders nothing for a reply', () => {
    renderReplies({ level: 'reply', expanded: true });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
