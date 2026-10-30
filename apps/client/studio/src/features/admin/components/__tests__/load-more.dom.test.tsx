import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppProviders } from '#app/__tests__/providers';
import { LoadMore } from '../load-more';

describe('apps/client/studio: LoadMore', () => {
  it('asks for the next page on click', async () => {
    const onLoadMore = vi.fn();
    render(<LoadMore hasNextPage fetching={false} onLoadMore={onLoadMore} />, {
      wrapper: AppProviders,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it('is absent on the last page', () => {
    render(<LoadMore hasNextPage={false} fetching={false} onLoadMore={vi.fn()} />, {
      wrapper: AppProviders,
    });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
