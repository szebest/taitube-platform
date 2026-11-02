import { QueryClient } from '@tanstack/react-query';
import { issueChannelImageUpload } from '@vp/api-contracts';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import axios from 'axios';
import { HttpResponse } from 'msw/http';

import { signedIn } from '#app/__tests__/providers';
import { useUploadChannelImages } from '../use-upload-channel-images';

const PNG = new File(['abcd'], 'me.png', { type: 'image/png' });

const upload = (files: Parameters<ReturnType<typeof useUploadChannelImages>['mutateAsync']>[0]) =>
  runMutation(new QueryClient(), useUploadChannelImages, files, signedIn());

describe('useUploadChannelImages', () => {
  beforeEach(() => {
    vi.spyOn(axios, 'put').mockResolvedValue({});
    apiServer.use(
      mockEndpoint(issueChannelImageUpload, async ({ request }) => {
        const { kind } = (await request.json()) as { kind: string };
        return HttpResponse.json(
          {
            key: `channels/c1/${kind}/i1.png`,
            uploadUrl: `http://localhost:9000/public/${kind}`,
            headers: {},
            expiresAt: '2026-01-01T01:00:00.000Z',
          },
          { status: 201 }
        );
      })
    );
  });

  it.each([
    { name: 'a picture', files: { avatar: PNG }, keys: { avatarKey: 'channels/c1/avatar/i1.png' } },
    { name: 'a banner', files: { banner: PNG }, keys: { bannerKey: 'channels/c1/banner/i1.png' } },
    {
      name: 'both',
      files: { avatar: PNG, banner: PNG },
      keys: { avatarKey: 'channels/c1/avatar/i1.png', bannerKey: 'channels/c1/banner/i1.png' },
    },
    { name: 'no file', files: {}, keys: {} },
  ])('answers the keys of $name it sent to storage', async ({ files, keys }) => {
    const outcome = await upload(files);

    expect(outcome).toEqual({ status: 'fulfilled', value: keys });
    expect(axios.put).toHaveBeenCalledTimes(Object.keys(files).length);
  });
});
