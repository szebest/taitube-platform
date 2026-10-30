import { render, screen } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import {
  page,
  renderSearch,
  searchReply,
  videoResult,
} from '#app/features/search/__tests__/search-fixtures';
import { SearchPageSkeleton } from '../search-page';

describe('apps/client/web: search page in the browser', () => {
  it.each([
    { label: 'no query', url: '/search' },
    { label: 'exclusions alone', url: '/search?q=-lofi' },
  ])('asks for a word on $label, and searches nothing', async ({ url }) => {
    const asked: string[] = [];

    await renderSearch(url, [searchReply(() => page([]), asked)]);

    expect(await screen.findByText('Type a word to search for')).toBeInTheDocument();
    expect(asked).toEqual([]);
  });

  it('shows the results the loader found', async () => {
    await renderSearch('/search?q=react', [searchReply(() => page([videoResult()]))]);

    expect(await screen.findByRole('heading', { name: 'Results for react' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'React in practice' })).toBeInTheDocument();
  });

  it('holds the place of the filters and six rows while the results load', () => {
    const { container } = render(<SearchPageSkeleton />, { wrapper: AppProviders });

    expect(container.querySelectorAll('[data-slot="video-card-skeleton"]')).toHaveLength(6);
    expect(container.querySelector('[data-slot="chip-bar-skeleton"]')).not.toBeNull();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
