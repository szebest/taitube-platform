import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { Suspense } from 'react';

import { AppWords } from '../app-words';
import { SectionBoundary } from '../section-boundary';

let failure: Error | undefined;

function Section() {
  const { data } = useSuspenseQuery({
    queryKey: ['section'],
    retry: false,
    queryFn: () => {
      if (failure) {
        const thrown = failure;
        failure = undefined;
        throw thrown;
      }
      return 'Loaded';
    },
  });
  return <p>{data}</p>;
}

function renderBoundary(props: { viewerTriggered?: boolean } = {}) {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppWords>
        <SectionBoundary message="It could not be loaded" resetKey="video" {...props}>
          <Suspense fallback={null}>
            <Section />
          </Suspense>
        </SectionBoundary>
      </AppWords>
    </QueryClientProvider>
  );
}

describe('@vp/queries: SectionBoundary', () => {
  it('says what failed and loads the section again on retry', async () => {
    failure = new Error('down');
    renderBoundary();

    expect(await screen.findByRole('alert')).toHaveTextContent('It could not be loaded');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Loaded')).toBeInTheDocument();
  });

  it.each([
    {
      failed: new ApiError(500, ErrorCodes.INTERNAL, ''),
      copy: 'Something went wrong on our side.',
    },
    {
      failed: new ApiError(503, ErrorCodes.DATABASE_UNAVAILABLE, ''),
      copy: 'The service is temporarily unavailable. Try again shortly.',
    },
    { failed: new Error('offline'), copy: 'Something went wrong on our side.' },
  ])('adds the presented copy for $failed.message', async ({ failed, copy }) => {
    failure = failed;
    renderBoundary();

    expect(await screen.findByRole('alert')).toHaveTextContent(copy);
  });

  it.each([
    { viewerTriggered: true, focused: true },
    { viewerTriggered: false, focused: false },
  ])(
    'focuses the retry for a viewer-triggered failure: $focused',
    async ({ viewerTriggered, focused }) => {
      failure = new Error('down');
      renderBoundary({ viewerTriggered });

      const retry = await screen.findByRole('button', { name: 'Try again' });

      expect(retry === document.activeElement).toBe(focused);
    }
  );
});
