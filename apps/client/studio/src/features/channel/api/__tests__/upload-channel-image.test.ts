import { issueChannelImageUpload } from '@vp/api-contracts';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import axios from 'axios';
import { HttpResponse } from 'msw/http';
import { uploadChannelImage } from '../upload-channel-image';

const UPLOAD_URL = 'http://localhost:9000/public/channels/c1/avatar/i1.png';

function issuing(bodies: unknown[]) {
  return mockEndpoint(issueChannelImageUpload, async ({ request }) => {
    bodies.push(await request.json());
    return HttpResponse.json(
      {
        key: 'channels/c1/avatar/i1.png',
        uploadUrl: UPLOAD_URL,
        headers: { 'content-type': 'image/png' },
        expiresAt: '2026-01-01T01:00:00.000Z',
      },
      { status: 201 }
    );
  });
}

describe('uploadChannelImage', () => {
  it('asks for a presigned PUT sized to the file, sends the file to it and returns the key', async () => {
    const bodies: unknown[] = [];
    apiServer.use(issuing(bodies));
    const put = vi.spyOn(axios, 'put').mockResolvedValue({});
    const file = new File(['abcd'], 'me.png', { type: 'image/png' });

    const key = await uploadChannelImage(api, 'avatar', file);

    expect(bodies).toEqual([{ kind: 'avatar', contentType: 'image/png', sizeBytes: 4 }]);
    expect(put).toHaveBeenCalledWith(
      UPLOAD_URL,
      file,
      expect.objectContaining({ headers: { 'content-type': 'image/png' } })
    );
    expect(key).toBe('channels/c1/avatar/i1.png');
  });
});
