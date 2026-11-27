import { screen, waitFor, within } from '@testing-library/react';
import { approveHeldVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { renderScreening, screeningCase } from '#app/features/admin/__tests__/screening.fixture';

const HELD = screeningCase({ title: 'Held clip' });
const FLAGGED = screeningCase({ title: 'Flagged clip', status: 'READY', outcome: 'PASS' });
const DECIDED = screeningCase({
  title: 'Decided clip',
  status: 'REJECTED',
  open: false,
  decision: 'rejected',
});

const rowOf = (text: string) => screen.getByText(text).closest('tr') as HTMLElement;

describe('apps/client/studio: ScreeningActions', () => {
  it.each([
    {
      case: 'approve and reject a held video',
      title: 'Held clip',
      buttons: ['Approve Held clip', 'Reject Held clip'],
    },
    {
      case: 'dismiss the flags of a video that stayed public',
      title: 'Flagged clip',
      buttons: ['Dismiss the flags on Flagged clip'],
    },
    { case: 'nothing on a decided case', title: 'Decided clip', buttons: [] },
  ])('offers $case', async ({ title, buttons }) => {
    await renderScreening('/admin/screening', { cases: [[HELD, FLAGGED, DECIDED]] });
    await screen.findByText(title);

    const names = within(rowOf(title))
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'))
      .filter((name) => name !== `Evidence for ${title}`);

    expect(names).toEqual(buttons);
  });

  it('approves with one click, without asking', async () => {
    const { user, requests } = await renderScreening('/admin/screening', { cases: [[HELD]] });

    await user.click(await screen.findByRole('button', { name: 'Approve Held clip' }));

    await waitFor(() =>
      expect(requests.decisions).toEqual([{ action: 'approve', id: HELD.videoId, body: undefined }])
    );
  });

  it('dismisses the flags with one click', async () => {
    const { user, requests } = await renderScreening('/admin/screening', { cases: [[FLAGGED]] });

    await user.click(
      await screen.findByRole('button', { name: 'Dismiss the flags on Flagged clip' })
    );

    await waitFor(() =>
      expect(requests.decisions).toEqual([
        { action: 'dismiss', id: FLAGGED.videoId, body: undefined },
      ])
    );
  });

  it('asks for a reason before it rejects', async () => {
    const { user } = await renderScreening('/admin/screening', { cases: [[HELD]] });

    await user.click(await screen.findByRole('button', { name: 'Reject Held clip' }));

    expect(await screen.findByRole('dialog', { name: 'Reject Held clip?' })).toBeInTheDocument();
  });

  it('toasts and keeps the case when a decision is refused', async () => {
    const { user } = await renderScreening('/admin/screening', {
      cases: [[HELD]],
      handlers: [mockEndpoint(approveHeldVideo, () => problemReply(ErrorCodes.VERSION_CONFLICT))],
    });

    await user.click(await screen.findByRole('button', { name: 'Approve Held clip' }));

    expect(
      await screen.findByText('The video changed while you were deciding. The list was refreshed.')
    ).toBeInTheDocument();
  });
});
