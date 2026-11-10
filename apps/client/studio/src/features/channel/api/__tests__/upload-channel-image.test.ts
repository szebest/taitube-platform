import { completeChannelImage, prepareChannelImage } from '@vp/api-contracts';
import type { ImageCrops } from '@vp/domain';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import axios from 'axios';
import { HttpResponse } from 'msw/http';
import { uploadChannelImage } from '../upload-channel-image';

const UPLOAD_ID = '0190c3a0-5e1d-7000-8000-000000000a01';
const UPLOAD_URL = 'http://localhost:9000/raw/channel-images/c1/avatar/i1';
const SIZE = { width: 2560, height: 1440 };

const FRAME = { x: 0, y: 0, width: 100, height: 100 };
const CROPS = {
  avatar: { kind: 'avatar', crop: FRAME },
  banner: { kind: 'banner', crops: { desktop: FRAME, mobile: FRAME, tv: FRAME } },
} satisfies Record<string, ImageCrops>;

function serving(prepared: unknown[], completed: unknown[]) {
  apiServer.use(
    mockEndpoint(prepareChannelImage, async ({ request, params }) => {
      prepared.push({ kind: params['kind'], body: await request.json() });
      return HttpResponse.json(
        {
          uploadId: UPLOAD_ID,
          uploadUrl: UPLOAD_URL,
          headers: { 'content-type': 'image/png' },
          expiresAt: '2026-01-01T01:00:00.000Z',
        },
        { status: 201 }
      );
    }),
    mockEndpoint(completeChannelImage, async ({ request, params }) => {
      completed.push({ kind: params['kind'], body: await request.json() });
      return HttpResponse.json({ uploadId: UPLOAD_ID, version: 3 }, { status: 202 });
    })
  );
}

describe('apps/client/studio: uploadChannelImage', () => {
  it.each([
    { kind: 'avatar', cropBody: { crop: FRAME } },
    { kind: 'banner', cropBody: { crops: CROPS.banner.crops } },
  ] as const)(
    'presigns a $kind, sends the file to it, then queues the job with the crops',
    async ({ kind, cropBody }) => {
      const prepared: unknown[] = [];
      const completed: unknown[] = [];
      serving(prepared, completed);
      const put = vi.spyOn(axios, 'put').mockResolvedValue({});
      const file = new File(['abcd'], 'me.png', { type: 'image/png' });
      const onPrepared = vi.fn();

      const queued = await uploadChannelImage(
        api,
        { kind, file, size: SIZE, crops: CROPS[kind] },
        onPrepared
      );

      expect(prepared).toEqual([{ kind, body: { contentType: 'image/png', sizeBytes: 4 } }]);
      expect(onPrepared).toHaveBeenCalledWith(UPLOAD_ID);
      expect(put).toHaveBeenCalledWith(
        UPLOAD_URL,
        file,
        expect.objectContaining({ headers: { 'content-type': 'image/png' } })
      );
      expect(completed).toEqual([{ kind, body: { uploadId: UPLOAD_ID, ...SIZE, ...cropBody } }]);
      expect(queued).toEqual({ uploadId: UPLOAD_ID, version: 3 });
    }
  );

  it('queues nothing when the file does not reach storage', async () => {
    const completed: unknown[] = [];
    serving([], completed);
    vi.spyOn(axios, 'put').mockRejectedValue(new Error('network'));
    const file = new File(['abcd'], 'me.png', { type: 'image/png' });

    await expect(
      uploadChannelImage(api, { kind: 'avatar', file, size: SIZE, crops: CROPS.avatar }, vi.fn())
    ).rejects.toThrow('network');

    expect(completed).toEqual([]);
  });
});
