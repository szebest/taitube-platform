import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { completeChannelImage, prepareChannelImage } from '@vp/api-contracts';
import type { ImageCrops } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { SESSION_KEY, UserEventStream } from '@vp/queries';
import { CHANNEL_ID, apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { streamUserEvents } from '@vp/web-testing/dom';
import axios from 'axios';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { signedIn } from '#app/__tests__/providers';
import { useChannelImageUpload } from '../use-channel-image-upload';

const UPLOAD_ID = '0190c3a0-5e1d-7000-8000-000000000a01';
const OTHER_UPLOAD_ID = '0190c3a0-5e1d-7000-8000-000000000a02';

const CHOICE = {
  file: new File(['abcd'], 'me.png', { type: 'image/png' }),
  size: { width: 400, height: 400 },
  crops: { kind: 'avatar', crop: { x: 0, y: 0, width: 400, height: 400 } } satisfies ImageCrops,
};

const ready = (uploadId: string) =>
  ({
    type: 'channel.image.ready',
    payload: { uploadId, channelId: CHANNEL_ID, kind: 'avatar', version: 2 },
  }) as const;

const failed = (uploadId: string) =>
  ({
    type: 'channel.image.failed',
    payload: { uploadId, channelId: CHANNEL_ID, kind: 'avatar', reason: 'unreadable' },
  }) as const;

function renderUpload() {
  const stream = streamUserEvents();
  const client = new QueryClient();
  const Session = signedIn();
  const invalidated = vi.spyOn(client, 'invalidateQueries');
  const { result } = renderHook(() => useChannelImageUpload('avatar'), {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>
        <Session>
          <UserEventStream>{children}</UserEventStream>
        </Session>
      </QueryClientProvider>
    ),
  });
  return { result, stream, invalidated };
}

function serving(complete: 'queues' | 'refuses' = 'queues') {
  vi.spyOn(axios, 'put').mockResolvedValue({});
  apiServer.use(
    mockEndpoint(prepareChannelImage, () =>
      HttpResponse.json(
        {
          uploadId: UPLOAD_ID,
          uploadUrl: 'http://localhost:9000/raw/x',
          headers: {},
          expiresAt: '2026-01-01T01:00:00.000Z',
        },
        { status: 201 }
      )
    ),
    mockEndpoint(completeChannelImage, () =>
      complete === 'queues'
        ? HttpResponse.json({ uploadId: UPLOAD_ID, version: 2 }, { status: 202 })
        : problemReply(ErrorCodes.IMAGE_TOO_SMALL)
    )
  );
}

async function started() {
  const rendered = renderUpload();
  act(() => rendered.result.current.start(CHOICE));
  await waitFor(() => expect(axios.put).toHaveBeenCalled());
  await waitFor(() => expect(rendered.result.current.status).toBe('working'));
  return rendered;
}

describe('apps/client/studio: useChannelImageUpload', () => {
  it('is idle until a choice is started', () => {
    serving();

    expect(renderUpload().result.current.status).toBe('idle');
  });

  it('keeps working after the job is queued, until the channel announces it, then refreshes the channel', async () => {
    serving();
    const { result, stream, invalidated } = await started();

    act(() => stream.send(ready(UPLOAD_ID)));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(invalidated).toHaveBeenCalledWith({ queryKey: ['channel', 'acting'] });
    expect(invalidated).toHaveBeenCalledWith({ queryKey: SESSION_KEY });
  });

  it.each([
    { scenario: 'the job failed', send: failed(UPLOAD_ID), status: 'failed' },
    { scenario: "another upload's job finished", send: ready(OTHER_UPLOAD_ID), status: 'working' },
    { scenario: "another upload's job failed", send: failed(OTHER_UPLOAD_ID), status: 'working' },
  ] as const)('answers $status when $scenario', async ({ send, status }) => {
    serving();
    const { result, stream } = await started();

    act(() => stream.send(send));

    await waitFor(() => expect(result.current.status).toBe(status));
  });

  it('fails when the API refuses to queue the job', async () => {
    serving('refuses');
    const { result } = renderUpload();

    act(() => result.current.start(CHOICE));

    await waitFor(() => expect(result.current.status).toBe('failed'));
  });

  it('goes back to idle on reset', async () => {
    serving();
    const { result } = await started();

    act(() => result.current.reset());

    expect(result.current.status).toBe('idle');
  });
});
