import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { SectionBoundary } from '../section-boundary';

let failures = 1;

function Section() {
  const { data } = useSuspenseQuery({
    queryKey: ['section'],
    retry: false,
    queryFn: () => {
      if (failures-- > 0) {
        throw new Error('down');
      }
      return 'Loaded';
    },
  });
  return <p>{data}</p>;
}

function renderBoundary() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppProviders>
        <SectionBoundary message="It could not be loaded" resetKey="video">
          <Suspense fallback={null}>
            <Section />
          </Suspense>
        </SectionBoundary>
      </AppProviders>
    </QueryClientProvider>
  );
}

describe('apps/client/web: section boundary', () => {
  it('says what failed in the section and loads it again on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    failures = 1;
    renderBoundary();

    expect(await screen.findByRole('alert')).toHaveTextContent('It could not be loaded');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Loaded')).toBeInTheDocument();
  });
});
