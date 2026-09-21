import { getFeed, getVideo, setReaction, startUpload } from '@vp/api-contracts';
import { ApiContractError, ApiError } from '../api-error';
import { sendRequest } from '../request';

const VIDEO_ID = '00000000-0000-7000-8000-000000000001';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function recordingFetch(makeResponse: () => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchStub = async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return makeResponse();
  };
  return { calls, fetchStub: fetchStub as unknown as typeof globalThis.fetch };
}

const emptyFeed = { items: [], nextCursor: null, total: 0 };

describe('packages/api-client: request', () => {
  it('fills path params and serialises the query', async () => {
    const { calls, fetchStub } = recordingFetch(() => jsonResponse(emptyFeed));

    await sendRequest({ baseUrl: 'http://localhost:3000/', fetch: fetchStub }, getFeed, {
      query: { sort: 'trending', limit: 50, categoryId: undefined },
    });

    expect(calls[0]?.url).toBe('http://localhost:3000/v1/feed?sort=trending&limit=50');
  });

  it('substitutes a path parameter', async () => {
    const { calls, fetchStub } = recordingFetch(() => jsonResponse({ videoId: VIDEO_ID, reaction: null }));

    await sendRequest(
      { baseUrl: 'http://localhost:3000', fetch: fetchStub },
      { ...setReaction, result: setReaction.result.partial() },
      { params: { id: VIDEO_ID }, body: { type: 'LIKE' } }
    );

    expect(calls[0]?.url).toBe(`http://localhost:3000/v1/videos/${VIDEO_ID}/reactions`);
    expect(calls[0]?.init.method).toBe('PUT');
    expect(calls[0]?.init.body).toBe('{"type":"LIKE"}');
  });

  it('sends a bearer token and a json content type only with a body', async () => {
    const { calls, fetchStub } = recordingFetch(() => jsonResponse(emptyFeed));
    const client = {
      baseUrl: 'http://localhost:3000',
      fetch: fetchStub,
      getAuthToken: () => 'token-1',
    };

    await sendRequest(client, getFeed);
    await sendRequest(
      client,
      { ...startUpload, result: startUpload.result.partial() },
      { body: { filename: 'a.mp4', sizeBytes: 1, contentType: 'video/mp4' } }
    );

    const headersOf = (index: number) => calls[index]?.init.headers as Record<string, string>;
    expect(headersOf(0)?.['authorization']).toBe('Bearer token-1');
    expect(headersOf(0)?.['content-type']).toBeUndefined();
    expect(headersOf(1)?.['content-type']).toBe('application/json');
  });

  it('resolves to undefined on 204 without reading a body', async () => {
    const { fetchStub } = recordingFetch(() => new Response(null, { status: 204 }));

    await expect(
      sendRequest({ baseUrl: 'http://localhost:3000', fetch: fetchStub }, getVideo, {
        params: { id: VIDEO_ID },
      })
    ).resolves.toBeUndefined();
  });

  it('throws an ApiError carrying the problem document', async () => {
    const { fetchStub } = recordingFetch(() =>
      jsonResponse(
        {
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'Video not found',
          code: 'VIDEO_NOT_FOUND',
          instance: `/v1/videos/${VIDEO_ID}`,
        },
        404
      )
    );

    await expect(
      sendRequest({ baseUrl: 'http://localhost:3000', fetch: fetchStub }, getVideo, {
        params: { id: VIDEO_ID },
      })
    ).rejects.toThrow(ApiError);
  });

  it('throws an ApiContractError when the payload does not match the contract', async () => {
    const { fetchStub } = recordingFetch(() => jsonResponse({ items: [{ id: 'not-a-uuid' }] }));

    await expect(
      sendRequest({ baseUrl: 'http://localhost:3000', fetch: fetchStub }, getFeed)
    ).rejects.toThrow(ApiContractError);
  });
});
