import { screen, within } from '@testing-library/react';
import { listScreeningCases } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw';
import {
  MATCHED_VIDEO,
  renderScreening,
  screeningCase,
  screeningFinding,
} from '#app/features/admin/__tests__/screening.fixture';

const HELD = screeningCase({
  title: 'Stolen clip',
  channel: { ...MATCHED_VIDEO.channel, displayName: 'Re-uploader' },
});
const FLAGGED = screeningCase({
  title: 'Spammy upload',
  status: 'READY',
  outcome: 'PASS',
  score: 0.4,
  reasons: [],
  flags: [screeningFinding({ reason: 'PARTIAL_MATCH', score: 0.4 })],
});
const APPROVED = screeningCase({
  title: 'Cleared upload',
  status: 'PROCESSING',
  open: false,
  decision: 'approved',
});

const rowOf = (text: string) => screen.getByText(text).closest('tr') as HTMLElement;

describe('apps/client/studio: ScreeningQueue', () => {
  it('lists each case with its score, reasons, state and the video it matched', async () => {
    await renderScreening('/admin/screening', { cases: [[HELD, FLAGGED, APPROVED]] });

    await screen.findByText('Stolen clip');
    const held = within(rowOf('Stolen clip'));
    expect(held.getByText('Re-uploader')).toBeInTheDocument();
    expect(held.getByText('93%')).toBeInTheDocument();
    expect(held.getByText('Duplicate of another video')).toBeInTheDocument();
    expect(held.getByText('Held')).toBeInTheDocument();
    expect(held.getByText('The original')).toBeInTheDocument();
    expect(held.getByText('First Uploader')).toBeInTheDocument();
    expect(held.getByText('00:12 to 01:05')).toBeInTheDocument();
    const flagged = within(rowOf('Spammy upload'));
    expect(flagged.getByText('Partial match')).toBeInTheDocument();
    expect(flagged.getByText('Flagged')).toBeInTheDocument();
    expect(flagged.getByText('No matching video')).toBeInTheDocument();
    expect(within(rowOf('Cleared upload')).getByText('Approved')).toBeInTheDocument();
  });

  it('opens the evidence of a case', async () => {
    const { user } = await renderScreening('/admin/screening', { cases: [[HELD]] });

    await user.click(await screen.findByRole('button', { name: 'Evidence for Stolen clip' }));

    expect(
      await screen.findByRole('dialog', { name: 'Evidence for Stolen clip' })
    ).toBeInTheDocument();
  });

  it('narrows to open or decided cases through the URL', async () => {
    const { user, requests, router } = await renderScreening('/admin/screening', {
      cases: [[HELD]],
    });
    await user.click(await screen.findByRole('combobox', { name: 'Show' }));
    await user.click(await screen.findByRole('option', { name: 'Decided' }));

    await vi.waitFor(() => expect(requests.queries.at(-1)?.get('state')).toBe('decided'));
    expect(router.state.location.search).toMatchObject({ state: 'decided' });
  });

  it('loads the next page on request', async () => {
    const { user, requests } = await renderScreening('/admin/screening', {
      cases: [[HELD], [APPROVED]],
    });
    await screen.findByText('Stolen clip');

    await user.click(screen.getAllByRole('button', { name: 'Load more' }).at(-1) as HTMLElement);

    expect(await screen.findByText('Cleared upload')).toBeInTheDocument();
    expect(requests.queries.map((query) => query.get('cursor'))).toEqual([null, '1']);
  });

  it('shows one empty state when nothing is held or flagged', async () => {
    await renderScreening('/admin/screening', { cases: [[]] });

    expect(await screen.findByText('Nothing held or flagged')).toBeInTheDocument();
  });

  it('keeps the page and offers a retry when the cases fail to load', async () => {
    let failing = true;
    const { user } = await renderScreening('/admin/screening', {
      handlers: [
        mockEndpoint(listScreeningCases, () =>
          failing
            ? problemReply(ErrorCodes.INTERNAL)
            : HttpResponse.json({ items: [HELD], nextCursor: null })
        ),
      ],
    });

    expect(
      await screen.findByText('The held and flagged videos did not load.')
    ).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Stolen clip')).toBeInTheDocument();
  });
});
