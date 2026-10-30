import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { listAdminVideos } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import type { PickVideo } from '#app/features/admin/api/pick-videos';
import { PickVideoPicker, type PickVideoPickerProps } from '../pick-video-picker';
import { CATS, OCEAN } from './picks.fixture';

const listing = (items: unknown[]) =>
  mockEndpoint(listAdminVideos, ({ request }) => {
    const text = new URL(request.url).searchParams.get('q')?.toLowerCase();
    const matching = items.filter(
      (video) => !text || JSON.stringify(video).toLowerCase().includes(text)
    );
    return HttpResponse.json({ items: matching as never, nextCursor: null });
  });

function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <AppProviders>{children}</AppProviders>
    </QueryClientProvider>
  );
}

const renderPicker = (props: Partial<PickVideoPickerProps> = {}) => {
  const onSelect = vi.fn();
  render(<PickVideoPicker selected={null} onSelect={onSelect} error={undefined} {...props} />, {
    wrapper: Providers,
  });
  return { onSelect, user: userEvent.setup() };
};

describe('apps/client/studio: PickVideoPicker', () => {
  it('lists public videos and reports the one chosen with Enter', async () => {
    apiServer.use(listing([CATS, OCEAN]));
    const { onSelect, user } = renderPicker();

    await user.click(await screen.findByRole('option', { name: 'Cats at dawn' }));

    expect(onSelect).toHaveBeenCalledWith(CATS);
  });

  it('narrows the list by the title typed', async () => {
    apiServer.use(listing([CATS, OCEAN]));
    const { user } = renderPicker();

    await user.type(await screen.findByRole('combobox', { name: 'Search public videos' }), 'ocean');

    expect(await screen.findByRole('option', { name: 'Ocean floor' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Cats at dawn' })).not.toBeInTheDocument();
  });

  it.each([
    { name: 'no match', handler: listing([]), text: 'No public, ready video matches.' },
    {
      name: 'a failed read',
      handler: mockEndpoint(listAdminVideos, () => problemReply('FORBIDDEN')),
      text: 'The videos did not load.',
    },
  ])('says so for $name', async ({ handler, text }) => {
    apiServer.use(handler);
    renderPicker();

    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('shows the chosen video and the error under the picker', async () => {
    apiServer.use(listing([CATS]));
    renderPicker({ selected: CATS as PickVideo, error: 'Choose a video.' });

    expect(await screen.findByText('Picked: Cats at dawn')).toBeInTheDocument();
    expect(screen.getByText('Choose a video.')).toBeInTheDocument();
  });
});
