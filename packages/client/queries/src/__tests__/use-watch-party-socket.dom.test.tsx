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
import { scriptSockets } from './scripted-socket';

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
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the socket on the API origin with the one-time pass and folds hello into the state', async () => {
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

  it('retries a pass the API did not issue, then opens', async () => {
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

  it('reconnects after a drop with a new pass, and not after the room ended the visit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result, socket } = renderRoom();
    await vi.waitFor(() => expect(result.current.state.connection).toBe('open'));

    act(() => socket.drop());
    await vi.waitFor(() => expect(socket.urls).toHaveLength(2), { timeout: 3000 });

    act(() => socket.push({ type: 'kicked' }));
    await vi.waitFor(() => expect(result.current.state.ended).toBe('kicked'));
    act(() => socket.drop());
    await vi.advanceTimersByTimeAsync(1500);

    expect(socket.urls).toHaveLength(2);
  });

  it('waits longer before each reconnect until the room says hello, then starts over', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const sockets = scriptSockets();
    renderRoom();
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    const reconnectsAfter = async (ms: number, { hello = false } = {}) => {
      const opened = sockets.length;
      const socket = sockets.at(-1);
      act(() => {
        socket?.open();
        if (hello) socket?.speak(partyHello());
        socket?.drop();
      });
      await act(() => vi.advanceTimersByTimeAsync(ms - 1));
      expect(sockets).toHaveLength(opened);
      await act(() => vi.advanceTimersByTimeAsync(1));
      await vi.waitFor(() => expect(sockets).toHaveLength(opened + 1));
    };

    await reconnectsAfter(1_000);
    await reconnectsAfter(2_000);
    await reconnectsAfter(4_000);
    await reconnectsAfter(1_000, { hello: true });
  });
});
