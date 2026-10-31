import { render, screen } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { RecordingObserver } from '#app/features/watch/__tests__/recording-observer';

import { PagedFooter, type PagedFooterProps } from '../paged-footer';

const IDLE: PagedFooterProps = {
  hasMore: false,
  isFetching: false,
  isError: false,
  onLoadMore: vi.fn(),
};

describe('apps/client/web: PagedFooter', () => {
  beforeEach(() => RecordingObserver.install());
  afterEach(() => vi.unstubAllGlobals());

  it('asks for the next page once the end is near', () => {
    const onLoadMore = vi.fn();
    render(<PagedFooter {...IDLE} hasMore onLoadMore={onLoadMore} />, { wrapper: AppProviders });

    RecordingObserver.enterView();

    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it.each([
    { scenario: 'there is no next page', props: {} },
    { scenario: 'a page is on its way', props: { hasMore: true, isFetching: true } },
  ])('watches nothing while $scenario', ({ props }) => {
    render(<PagedFooter {...IDLE} {...props} />, { wrapper: AppProviders });

    expect(RecordingObserver.all).toHaveLength(0);
  });

  it('offers a retry when the next page failed, and watches nothing', () => {
    const onLoadMore = vi.fn();
    render(<PagedFooter {...IDLE} hasMore isError onLoadMore={onLoadMore} />, {
      wrapper: AppProviders,
    });

    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded');
    expect(RecordingObserver.all).toHaveLength(0);
  });
});
