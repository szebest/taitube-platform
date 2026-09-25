import { recordRequests } from '../../__tests__/api-store';
import { CHANNEL_ID } from '../../__tests__/fixtures';
import { serverRender } from '../../__tests__/server-render';

describe('apps/web: /channel/$channelId', () => {
  it.each([
    { scenario: 'a channel id', path: `/channel/${CHANNEL_ID}`, status: 200 },
    { scenario: 'a segment that is not a channel id', path: '/channel/not-a-channel', status: 404 },
  ])('answers $scenario with $status', async ({ path, status }) => {
    const sent = recordRequests();

    const rendered = await serverRender(path);

    expect(rendered.status).toBe(status);
    expect(sent).toEqual([]);
  });
});
