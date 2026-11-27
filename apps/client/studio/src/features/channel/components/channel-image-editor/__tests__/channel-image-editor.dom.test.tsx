import { screen, waitFor, within } from '@testing-library/react';
import { completeChannelImage, prepareChannelImage, updateMyChannel } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { CHANNEL_ID, apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { streamUserEvents } from '@vp/web-testing/dom';
import axios from 'axios';
import { HttpResponse } from 'msw/http';
import { renderCustomization } from '#app/features/channel/__tests__/render-customization';

const UPLOAD_ID = '0190c3a0-5e1d-7000-8000-000000000a01';

const section = () => screen.getByRole('form', { name: 'Picture and banner' });
const dialog = (name: string) => screen.findByRole('dialog', { name });

const PNG = (name = 'me.png', bytes = 4) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/png' });

function decodesAs(width: number, height: number) {
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close: vi.fn() }));
}

function serving(prepared: unknown[] = [], completed: unknown[] = []) {
  apiServer.use(
    mockEndpoint(prepareChannelImage, async ({ request, params }) => {
      prepared.push({ kind: params['kind'], body: await request.json() });
      return HttpResponse.json(
        {
          uploadId: UPLOAD_ID,
          uploadUrl: 'http://localhost:9000/raw/channel-images/x',
          headers: {},
          expiresAt: '2026-01-01T01:00:00.000Z',
        },
        { status: 201 }
      );
    }),
    mockEndpoint(completeChannelImage, async ({ request, params }) => {
      completed.push({ kind: params['kind'], body: await request.json() });
      return HttpResponse.json({ uploadId: UPLOAD_ID, version: 2 }, { status: 202 });
    })
  );
}

function choose(
  user: Awaited<ReturnType<typeof renderCustomization>>['user'],
  label: RegExp,
  file: File
) {
  const input = within(section())
    .getByText(label)
    .closest('div')
    ?.querySelector('input[type="file"]');
  if (!input) throw new Error(`No file input under ${label}`);
  return user.upload(input as HTMLInputElement, file);
}

describe('apps/client/studio: channel image editor', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it.each([
    {
      kind: 'picture',
      drop: /Drop a picture here/,
      title: 'Frame your picture',
      apiKind: 'avatar' as const,
      size: [800, 600],
      crop: { crop: { x: 100, y: 0, width: 600, height: 600 } },
    },
    {
      kind: 'banner',
      drop: /Drop a banner here/,
      title: 'Frame your banner',
      apiKind: 'banner' as const,
      size: [2560, 1440],
      crop: {
        crops: {
          desktop: { x: 0, y: 507, width: 2560, height: 427 },
          mobile: { x: 0, y: 294, width: 2560, height: 853 },
          tv: { x: 0, y: 0, width: 2560, height: 1440 },
        },
      },
    },
  ])(
    'frames a $kind, uploads it and says so once the channel has it',
    async ({ drop, title, apiKind, size, crop }) => {
      const prepared: unknown[] = [];
      const completed: unknown[] = [];
      const stream = streamUserEvents();
      const put = vi.spyOn(axios, 'put').mockResolvedValue({});
      decodesAs(size[0] ?? 0, size[1] ?? 0);
      serving(prepared, completed);
      const { user } = await renderCustomization();

      await choose(user, drop, PNG());
      const cropper = await dialog(title);
      await user.click(within(cropper).getByRole('button', { name: 'Use this image' }));

      await waitFor(() => expect(completed).toHaveLength(1));
      expect(prepared).toEqual([
        { kind: apiKind, body: { contentType: 'image/png', sizeBytes: 4 } },
      ]);
      expect(put).toHaveBeenCalledTimes(1);
      expect(completed).toEqual([
        { kind: apiKind, body: { uploadId: UPLOAD_ID, width: size[0], height: size[1], ...crop } },
      ]);
      expect(
        within(cropper).getByRole('progressbar', { name: 'Uploading and processing your image' })
      ).toBeInTheDocument();

      stream.send({
        type: 'channel.image.ready',
        payload: { uploadId: UPLOAD_ID, channelId: CHANNEL_ID, kind: apiKind, version: 2 },
      });

      expect(await within(cropper).findByText('Your image is saved')).toBeInTheDocument();
      expect(within(cropper).getByRole('button', { name: 'Done' })).toBeInTheDocument();
    }
  );

  it('says so when the job fails, and lets the creator try again', async () => {
    const stream = streamUserEvents();
    vi.spyOn(axios, 'put').mockResolvedValue({});
    decodesAs(800, 800);
    serving();
    const { user } = await renderCustomization();

    await choose(user, /Drop a picture here/, PNG());
    const cropper = await dialog('Frame your picture');
    await user.click(within(cropper).getByRole('button', { name: 'Use this image' }));
    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    stream.send({
      type: 'channel.image.failed',
      payload: { uploadId: UPLOAD_ID, channelId: CHANNEL_ID, kind: 'avatar', reason: 'unreadable' },
    });

    expect(await within(cropper).findByRole('alert')).toHaveTextContent(
      'The image could not be saved'
    );
    expect(within(cropper).getByRole('button', { name: 'Use this image' })).toBeEnabled();
  });

  it('says so when the file does not reach storage', async () => {
    vi.spyOn(axios, 'put').mockRejectedValue(new Error('network'));
    decodesAs(800, 800);
    serving();
    const { user } = await renderCustomization();

    await choose(user, /Drop a picture here/, PNG());
    const cropper = await dialog('Frame your picture');
    await user.click(within(cropper).getByRole('button', { name: 'Use this image' }));

    expect(await within(cropper).findByRole('alert')).toHaveTextContent(
      'The image could not be saved'
    );
  });

  it('closes the cropper without uploading when the creator cancels', async () => {
    const prepared: unknown[] = [];
    decodesAs(800, 800);
    serving(prepared);
    const { user } = await renderCustomization();

    await choose(user, /Drop a picture here/, PNG());
    const cropper = await dialog('Frame your picture');
    await user.click(within(cropper).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(prepared).toEqual([]);
  });

  it.each([
    {
      scenario: 'a picture under 200 x 200',
      drop: /Drop a picture here/,
      size: [199, 400],
      message: 'This image is too small: it must be at least 200 x 200 px.',
    },
    {
      scenario: 'a banner under 1024 x 576',
      drop: /Drop a banner here/,
      size: [1000, 600],
      message: 'This image is too small: it must be at least 1,024 x 576 px.',
    },
  ])('refuses $scenario before the cropper', async ({ drop, size, message }) => {
    decodesAs(size[0] ?? 0, size[1] ?? 0);
    const { user } = await renderCustomization();

    await choose(user, drop, PNG());

    expect(await within(section()).findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('refuses a file the browser cannot decode', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('InvalidStateError')));
    const { user } = await renderCustomization();

    await choose(user, /Drop a picture here/, PNG());

    expect(await within(section()).findByRole('alert')).toHaveTextContent(
      'This file could not be read as an image.'
    );
  });

  it('refuses a picture over its size cap with no cropper', async () => {
    decodesAs(800, 800);
    const { user } = await renderCustomization();

    await choose(user, /Drop a picture here/, PNG('big.png', 2 * 1024 * 1024 + 1));

    expect(
      await within(section()).findByText(/exceeds the maximum upload size/)
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says so when taking an image away is refused', async () => {
    const { user } = await renderCustomization({ avatarUrl: 'https://cdn.test/a.png' }, [
      mockEndpoint(updateMyChannel, () => problemReply(ErrorCodes.INTERNAL)),
    ]);

    await user.click(within(section()).getByRole('button', { name: 'Remove picture' }));

    expect(await within(section()).findByRole('alert')).toHaveTextContent('Could not save');
  });
});
