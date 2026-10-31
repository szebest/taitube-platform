import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPlaylist } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { createToaster, ToastProvider } from '@vp/ui';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { playlistDetail, uuid } from '#app/features/library/__tests__/library-fixtures';
import { NewPlaylistForm } from '../new-playlist-form';

function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <AppProviders>
        <ToastProvider toaster={createToaster()}>{children}</ToastProvider>
      </AppProviders>
    </QueryClientProvider>
  );
}

function setup() {
  const bodies: unknown[] = [];
  apiServer.use(
    mockEndpoint(createPlaylist, async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(playlistDetail(uuid(4900), []), { status: 201 });
    })
  );
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  render(<NewPlaylistForm onCreated={onCreated} onCancel={onCancel} />, { wrapper: Providers });
  return { user: userEvent.setup(), bodies, onCreated, onCancel };
}

describe('apps/client/web: NewPlaylistForm', () => {
  it('holds Create back until the playlist has a title', async () => {
    const { user } = setup();
    const create = screen.getByRole('button', { name: 'Create' });

    expect(create).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Trips');

    expect(create).toBeEnabled();
  });

  it('creates the playlist as private unless told otherwise, then reports it', async () => {
    const { user, bodies, onCreated } = setup();

    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Trips');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(bodies).toEqual([{ title: 'Trips', visibility: 'private' }]);
  });

  it('hands back to the caller on Cancel without writing', async () => {
    const { user, bodies, onCancel } = setup();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(bodies).toEqual([]);
  });
});
