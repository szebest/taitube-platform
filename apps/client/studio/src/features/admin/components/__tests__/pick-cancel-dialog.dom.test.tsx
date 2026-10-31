import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cancelPick } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import type { HttpHandler } from 'msw';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { PickCancelDialog } from '../pick-cancel-dialog';
import { adminPick } from './picks.fixture';

const PICK = adminPick();

function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <AppProviders>{children}</AppProviders>
    </QueryClientProvider>
  );
}

const renderCancel = (handler: HttpHandler) => {
  const onClose = vi.fn();
  apiServer.use(handler);
  render(<PickCancelDialog pick={PICK} onClose={onClose} />, { wrapper: Providers });
  return { onClose, user: userEvent.setup() };
};

describe('apps/client/studio: PickCancelDialog', () => {
  it('names the pick and its window, and cancels it on confirm', async () => {
    const asked: string[] = [];
    const { onClose, user } = renderCancel(
      mockEndpoint(cancelPick, ({ params }) => {
        asked.push(String(params['id']));
        return new HttpResponse(null, { status: 204 });
      })
    );

    expect(screen.getByText(/Mountain lakes stops being the pick for/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel pick' }));

    await waitFor(() => expect(asked).toEqual([PICK.id]));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('keeps the pick when asked to', async () => {
    const asked: string[] = [];
    const { onClose, user } = renderCancel(
      mockEndpoint(cancelPick, () => {
        asked.push('called');
        return new HttpResponse(null, { status: 204 });
      })
    );

    await user.click(screen.getByRole('button', { name: 'Keep pick' }));

    expect(onClose).toHaveBeenCalled();
    expect(asked).toEqual([]);
  });

  it('says so when the pick could not be cancelled', async () => {
    const { user } = renderCancel(mockEndpoint(cancelPick, () => problemReply('PICK_NOT_FOUND')));

    await user.click(screen.getByRole('button', { name: 'Cancel pick' }));

    expect(await screen.findByText('The pick was not cancelled.')).toBeInTheDocument();
  });
});
