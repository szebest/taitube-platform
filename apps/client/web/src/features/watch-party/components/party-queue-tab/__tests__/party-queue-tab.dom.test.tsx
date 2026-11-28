import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import {
  addToWatchPartyQueue,
  moveWatchPartyQueueItem,
  removeWatchPartyQueueItem,
} from '@vp/api-contracts';
import type { PartyQueueView } from '@vp/api-contracts';
import type { WatchPartyViewer } from '@vp/permissions';
import { apiServer, mockEndpoint, PARTY_ID, PARTY_OWNER_KEY } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { partyState } from '#app/features/watch-party/__tests__/party-state';
import { partyViewer, renderParty } from '#app/features/watch-party/__tests__/render-party';
import { PartyQueueTab } from '../party-queue-tab';

const VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000c001';
const FIRST = '0190c3a0-5e1d-7000-8000-000000009201';
const SECOND = '0190c3a0-5e1d-7000-8000-000000009202';

const QUEUE: PartyQueueView = {
  version: 2,
  items: [FIRST, SECOND].map((id, index) => ({
    id,
    video: { id: `v${index}`, title: `Video ${index + 1}`, durationMs: 60_000, thumbnailUrl: null },
    addedBy: PARTY_OWNER_KEY,
    startMs: 0,
    playedAt: null,
  })),
};

function renderQueue(viewer: WatchPartyViewer) {
  renderParty(
    <PartyQueueTab
      roomId={PARTY_ID}
      socket={{
        state: partyState({ queue: QUEUE }),
        serverNow: () => 0,
        send: () => true,
        dismissRequest: () => undefined,
      }}
    />,
    viewer
  );
}

describe('apps/client/web: PartyQueueTab', () => {
  it('adds the video a pasted link names', async () => {
    const added: unknown[] = [];
    apiServer.use(
      mockEndpoint(addToWatchPartyQueue, async ({ request }) => {
        added.push(await request.json());
        return HttpResponse.json(QUEUE, { status: 201 });
      })
    );
    renderQueue(partyViewer(['queue.add']));

    await userEvent.click(screen.getByRole('button', { name: 'Add to the queue' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Video link or ID' }),
      `https://taitube.test/watch/${VIDEO_ID}`
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await vi.waitFor(() => expect(added).toEqual([{ videoId: VIDEO_ID }]));
  });

  it('refuses text that names no video, without asking the server', async () => {
    renderQueue(partyViewer(['queue.add']));

    await userEvent.click(screen.getByRole('button', { name: 'Add to the queue' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Video link or ID' }), 'bunny');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That is not a Taitube video link');
  });

  it('removes an item for a viewer who may', async () => {
    const removed: unknown[] = [];
    apiServer.use(
      mockEndpoint(removeWatchPartyQueueItem, ({ params }) => {
        removed.push(params.itemId);
        return new HttpResponse(null, { status: 204 });
      })
    );
    renderQueue(partyViewer(['queue.remove']));

    await userEvent.click(screen.getByRole('button', { name: 'Remove Video 2' }));

    await vi.waitFor(() => expect(removed).toEqual([SECOND]));
  });

  it('moves an item one place, leaving no move past either end', async () => {
    const moved: unknown[] = [];
    apiServer.use(
      mockEndpoint(moveWatchPartyQueueItem, async ({ params, request }) => {
        moved.push({ itemId: params.itemId, body: await request.json() });
        return HttpResponse.json(QUEUE);
      })
    );
    renderQueue(partyViewer(['queue.reorder']));

    expect(screen.queryByRole('button', { name: 'Move Video 1 up' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move Video 2 down' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Move Video 2 up' }));

    await vi.waitFor(() => expect(moved).toEqual([{ itemId: SECOND, body: { toIndex: 0 } }]));
  });

  it('offers a listener none of the three', () => {
    renderQueue(partyViewer(['chat.post']));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
