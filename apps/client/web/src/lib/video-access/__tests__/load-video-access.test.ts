import { isNotFound } from '@tanstack/react-router';
import { ApiError } from '@vp/api-client';
import { getVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint, problemReply, VIDEO_ID, video } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { loadVideoAccess } from '../load-video-access';

const SHARE_TOKEN = 'abcdefghijklmnopqrstuv';

const load = (shareToken?: string) =>
  loadVideoAccess(createQueryClient(), api, VIDEO_ID, shareToken);

describe('apps/client/web: loadVideoAccess', () => {
  it('reads the video with the share token the URL carries', async () => {
    const tokens: (string | null)[] = [];
    apiServer.use(
      mockEndpoint(getVideo, ({ request }) => {
        tokens.push(new URL(request.url).searchParams.get('s'));
        return HttpResponse.json(video({ title: 'Launch day' }));
      })
    );

    const access = await load(SHARE_TOKEN);

    expect(access).toMatchObject({ kind: 'open', video: { title: 'Launch day' } });
    expect(tokens).toEqual([SHARE_TOKEN]);
  });

  it.each([
    { refusal: ErrorCodes.VIDEO_PASSWORD_REQUIRED, kind: 'password' },
    { refusal: ErrorCodes.SHARE_LINK_EXPIRED, kind: 'expired' },
  ])('turns $refusal into the $kind gate', async ({ refusal, kind }) => {
    apiServer.use(mockEndpoint(getVideo, () => problemReply(refusal)));

    expect(await load()).toEqual({ kind });
  });

  it('leaves a missing video to the not-found page', async () => {
    apiServer.use(mockEndpoint(getVideo, () => problemReply(ErrorCodes.VIDEO_NOT_FOUND)));

    const refused = await load().catch((error: unknown) => error);

    expect(isNotFound(refused)).toBe(true);
  });

  it('leaves any other failure to the error page', async () => {
    apiServer.use(mockEndpoint(getVideo, () => problemReply(ErrorCodes.INTERNAL)));

    await expect(load()).rejects.toBeInstanceOf(ApiError);
  });
});
