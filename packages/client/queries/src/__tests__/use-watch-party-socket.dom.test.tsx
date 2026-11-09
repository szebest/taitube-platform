import { act, renderHook } from '@testing-library/react';
import { createApiClient } from '@vp/api-client';
import { createWatchPartySocketTicket } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import {
  apiServer,
  LOCAL_API_BASE_URL,
  mockEndpoint,
  PARTY_ID,
  partyHello,
  problemReply,
} from '@vp/web-testing';
import { mockWatchPartySocket } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { ApiProvider } from '../api-provider';
import { useWatchPartySocket } from '../use-watch-party-socket';

const ticket = mockEndpoint(createWatchPartySocketTicket, () =>
  HttpResponse.json({ ticket: 'ticket-1', expiresAt: '2026-11-05T10:00:30.000Z' }, { status: 201 })
);

function renderRoom(ticketReplies = [ticket]) {
  const socket = mockWatchPartySocket([partyHello()], 5_000);
  apiServer.use(...ticketReplies, socket.handler);
  const api = createApiClient({ baseUrl: LOCAL_API_BASE_URL });
  const wrapper = ({ children }: PropsWithChildren) => (
    <ApiProvider api={api}>{children}</ApiProvider>
  );
  const rendered = renderHook(
    () => useWatchPartySocket({ roomId: PARTY_ID, apiUrl: LOCAL_API_BASE_URL }),
    { wrapper }
  );
  return { ...rendered, socket };
}

describe('packages/queries: useWatchPartySocket', () => {
  it('opens the socket on the API origin with the ticket and folds hello into the state', async () => {
    const { result, socket } = renderRoom();

    await vi.waitFor(() => expect(result.current.state.connection).toBe('open'));

    expect(socket.urls).toEqual([
      `ws://localhost:3000/v1/watch-parties/${PARTY_ID}/socket?ticket=ticket-1`,
    ]);
    expect(result.current.state.room?.name).toBe('Movie night');
  });

  it('pings the clock on open and reads the server time from the answer', async () => {
    const { result, socket } = renderRoom();

    await vi.waitFor(() =>
      expect(socket.received).toEqual([{ type: 'clock', t0: expect.any(Number) }])
    );

    await vi.waitFor(() =>
      expect(Math.abs(result.current.serverNow() - 5_000)).toBeLessThan(1_000)
    );
  });

  it('sends a frame once the socket is open and reports a closed one as unsent', async () => {
    const { result, socket } = renderRoom();
    expect(result.current.send({ type: 'ready', ready: true })).toBe(false);
    await vi.waitFor(() => expect(result.current.state.connection).toBe('open'));

    act(() => {
      result.current.send({ type: 'ready', ready: true });
    });

    await vi.waitFor(() => expect(socket.received).toContainEqual({ type: 'ready', ready: true }));
  });

  it('retries a ticket the API did not issue, then opens', async () => {
    let asked = 0;
    const refusedOnce = mockEndpoint(createWatchPartySocketTicket, () => {
      asked += 1;
      return asked === 1
        ? problemReply(ErrorCodes.CACHE_UNAVAILABLE)
        : HttpResponse.json(
            { ticket: 'ticket-1', expiresAt: '2026-11-05T10:00:30.000Z' },
            { status: 201 }
          );
    });
    const { result } = renderRoom([refusedOnce]);

    await vi.waitFor(() => expect(result.current.state.connection).toBe('closed'));
    await vi.waitFor(() => expect(result.current.state.connection).toBe('open'), { timeout: 3000 });
  });

  it('reconnects after a drop with a new ticket, and not after the room ended the visit', async () => {
    const { result, socket } = renderRoom();
    await vi.waitFor(() => expect(result.current.state.connection).toBe('open'));

    act(() => socket.drop());
    await vi.waitFor(() => expect(socket.urls).toHaveLength(2), { timeout: 3000 });

    act(() => socket.push({ type: 'kicked' }));
    await vi.waitFor(() => expect(result.current.state.ended).toBe('kicked'));
    act(() => socket.drop());
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(socket.urls).toHaveLength(2);
  });
});
