import { act, renderHook } from '@testing-library/react';
import { createLiveChatTicket } from '@vp/api-contracts';
import { createApiClient } from '@vp/api-client';
import {
  account,
  apiServer,
  chatLine,
  LOCAL_API_BASE_URL,
  mockEndpoint,
  mockLiveChatSocket,
} from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';

import { ApiProvider } from '../api-provider';
import { GUEST, type Session } from '../session';
import { SessionProvider } from '../session-provider';
import { useLiveChat } from '../use-live-chat';

const STREAM_ID = '0190c3a0-5e1d-7000-8000-00000000e001';
const SIGNED_IN: Session = { status: 'signed-in', account: account() };

const ticket = mockEndpoint(createLiveChatTicket, () =>
  HttpResponse.json({ ticket: 'ticket-1', expiresAt: '2026-11-05T10:00:30.000Z' }, { status: 201 })
);

function renderChat({ session = SIGNED_IN, lines = [chatLine(1, 'Hello there')] } = {}) {
  const socket = mockLiveChatSocket(lines, { canSend: session.status === 'signed-in' });
  apiServer.use(ticket, socket.handler);
  const api = createApiClient({ baseUrl: LOCAL_API_BASE_URL });
  const wrapper = ({ children }: PropsWithChildren) => (
    <ApiProvider api={api}>
      <SessionProvider session={session}>{children}</SessionProvider>
    </ApiProvider>
  );
  const rendered = renderHook(
    () => useLiveChat({ liveStreamId: STREAM_ID, apiUrl: LOCAL_API_BASE_URL }),
    { wrapper }
  );
  return { ...rendered, socket };
}

describe('packages/queries: useLiveChat', () => {
  it.each([
    { viewer: 'a signed-in viewer', session: SIGNED_IN, query: '?ticket=ticket-1', canSend: true },
    { viewer: 'a guest', session: GUEST, query: '', canSend: false },
  ])('opens the socket on the API origin for $viewer', async ({ session, query, canSend }) => {
    const { result, socket } = renderChat({ session });

    await vi.waitFor(() => expect(result.current.lines).toHaveLength(1));

    expect(socket.urls).toEqual([`ws://localhost:3000/v1/live/${STREAM_ID}/chat${query}`]);
    expect(result.current).toMatchObject({ connection: 'open', canSend });
    expect(result.current.lines[0]).toMatchObject({ text: 'Hello there', state: 'sent' });
  });

  it('sends a line as a pending line with a ref the socket can answer', async () => {
    const { result, socket } = renderChat({ lines: [] });
    await vi.waitFor(() => expect(result.current.connection).toBe('open'));

    act(() => result.current.send('hi'));

    expect(result.current.lines).toEqual([expect.objectContaining({ text: 'hi', state: 'pending' })]);
    await vi.waitFor(() =>
      expect(socket.received).toEqual([
        { type: 'send', ref: result.current.lines[0]?.key, message: 'hi' },
      ])
    );
  });

  it('removes a line through the socket', async () => {
    const { result, socket } = renderChat();
    await vi.waitFor(() => expect(result.current.lines).toHaveLength(1));

    act(() => result.current.remove('line-1'));

    await vi.waitFor(() => expect(socket.received).toEqual([{ type: 'remove', id: 'line-1' }]));
  });
});
