import { endpointFor } from '../endpoint-for';

describe('@vp/web-testing: endpointFor', () => {
  it.each([
    { method: 'GET', url: 'http://localhost:3000/v1/videos?limit=30', name: 'listVideos' },
    {
      method: 'GET',
      url: 'http://localhost:3000/v1/channels/marta/featured',
      name: 'getChannelFeatured',
    },
    {
      method: 'PUT',
      url: 'http://localhost:3000/v1/me/channel/featured',
      name: 'setChannelFeatured',
    },
    { method: 'GET', url: 'http://localhost:3000/health', name: undefined },
  ])('names $method $url as $name', ({ method, url, name }) => {
    expect(endpointFor(method, url)).toBe(name);
  });
});
