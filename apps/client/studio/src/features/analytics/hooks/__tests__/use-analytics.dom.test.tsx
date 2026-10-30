import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

import { signedIn } from '#app/__tests__/providers';
import { serveAnalytics } from '../../__tests__/analytics-api.fixture';
import type { AnalyticsRange } from '../../types';
import { useAnalytics } from '../use-analytics';

const Providers = signedIn();

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient()}>
    <Providers>{children}</Providers>
  </QueryClientProvider>
);

describe('apps/client/studio: useAnalytics', () => {
  it('keeps the last range on screen while the next one loads', async () => {
    serveAnalytics({ views: [1, 2] });
    const { result, rerender } = renderHook(
      ({ range }: { range: AnalyticsRange }) => useAnalytics({ kind: 'channel' }, range),
      { wrapper, initialProps: { range: '30d' } }
    );
    await waitFor(() => expect(result.current.data?.rangeViews).toBe(3));

    rerender({ range: '7d' });

    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.rangeViews).toBe(3);
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
  });
});
