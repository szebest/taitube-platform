import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { getVideo } from '@vp/api-contracts';
import { HttpResponse } from 'msw/http';
import { type PropsWithChildren, createContext, useContext } from 'react';

import { video } from '../fixtures';
import { api, mockEndpoint } from '../local-api';
import { renderPage } from '../render-page';

const Greeting = createContext('nobody');

function Providers({ children }: PropsWithChildren) {
  return <Greeting value="the app">{children}</Greeting>;
}

function Page() {
  const greeting = useContext(Greeting);
  const { videoId } = useParams({ strict: false });
  const cached = useQueryClient().getQueryData<{ title: string }>(['video', videoId]);
  return <p>{`${greeting}: ${videoId ?? 'no param'}, ${cached?.title ?? 'no cache'}`}</p>;
}

function renderGreeting(options: Parameters<typeof renderPage>[2] = {}) {
  return renderPage(<Page />, Providers, options);
}

describe('@vp/web-testing: renderPage', () => {
  it("renders the page inside the app's providers at the root of a one-route router", async () => {
    expect(await renderGreeting()).toBe('<p>the app: no param, no cache</p>');
  });

  it('reads the params of the route the page sits on, under its layout, from the cache it was given', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['video', 'v1'], { title: 'Launch day' });

    const markup = await renderGreeting({
      queryClient,
      url: '/watch/v1',
      route: '/watch/$videoId',
      layout: '_authed',
    });

    expect(markup).toBe('<p>the app: v1, Launch day</p>');
  });

  it('answers the API with the handlers the spec hands it, for one test', async () => {
    await renderGreeting({
      handlers: [mockEndpoint(getVideo, () => HttpResponse.json(video({ title: 'Answered' })))],
    });

    expect((await api.videos.getVideo({ params: { id: video().id } })).title).toBe('Answered');
  });
});
