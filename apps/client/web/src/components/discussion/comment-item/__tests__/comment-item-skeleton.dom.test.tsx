import { render } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { CommentItemSkeleton } from '../comment-item-skeleton';

const renderSkeleton = (level?: 'comment' | 'reply') =>
  render(
    <AppProviders>
      <CommentItemSkeleton level={level} />
    </AppProviders>
  );

describe('apps/client/web: CommentItemSkeleton', () => {
  it.each([{ level: undefined }, { level: 'reply' as const }])(
    'is hidden from assistive tech at level $level',
    ({ level }) => {
      const { container } = renderSkeleton(level);

      expect(container.querySelector('[data-slot="comment-item-skeleton"]')).toHaveAttribute(
        'aria-hidden',
        'true'
      );
    }
  );
});
