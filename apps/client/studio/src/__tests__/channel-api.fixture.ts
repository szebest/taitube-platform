import { getMyChannel, getMySpotlight, setMySpotlight } from '@vp/api-contracts';
import { channel, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

/** The acting channel and its spotlight as the API answers them for a creator whose channel is `own`. */
export function channelApi(own: Parameters<typeof channel>[0] = {}) {
  return [
    mockEndpoint(getMyChannel, () => HttpResponse.json(channel(own))),
    mockEndpoint(getMySpotlight, () =>
      HttpResponse.json({ trailerVideoId: null, returningVideoId: null, localizations: [] })
    ),
    mockEndpoint(setMySpotlight, async ({ request }) => HttpResponse.json(await request.json())),
  ];
}
