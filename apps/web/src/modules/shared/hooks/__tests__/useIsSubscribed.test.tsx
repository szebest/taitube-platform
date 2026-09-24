import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { type ApiStore, createApiStore, seed } from '../../../../__tests__/api-store';
import { CHANNEL_ID } from '../../../../__tests__/fixtures';
import { subscriptionsApi } from '../../api/subscriptions-api';
import { useIsSubscribed } from '../useIsSubscribed';

type ProbeProps = { channelId: string | undefined; isLoggedIn: boolean };

function SubscriptionProbe({ channelId, isLoggedIn }: ProbeProps) {
  const { isSubscribed, isLoading } = useIsSubscribed(channelId, isLoggedIn);
  return <span>{`subscribed=${isSubscribed} loading=${isLoading}`}</span>;
}

function render(store: ApiStore, props: ProbeProps): string {
  return renderToStaticMarkup(
    <Provider store={store}>
      <SubscriptionProbe {...props} />
    </Provider>
  );
}

describe('apps/web: is subscribed', () => {
  it.each<{ scenario: string } & ProbeProps>([
    { scenario: 'a guest', channelId: CHANNEL_ID, isLoggedIn: false },
    { scenario: 'a page with no channel yet', channelId: undefined, isLoggedIn: true },
  ])('asks nothing and reports not subscribed for $scenario', ({ channelId, isLoggedIn }) => {
    expect(render(createApiStore(), { channelId, isLoggedIn })).toContain(
      'subscribed=false loading=false'
    );
  });

  it('reports loading while a signed-in viewer waits for the answer', () => {
    expect(render(createApiStore(), { channelId: CHANNEL_ID, isLoggedIn: true })).toContain(
      'subscribed=false loading=true'
    );
  });

  it.each([true, false])('reports the answer the API gave: subscribed=%s', async (subscribed) => {
    const store = createApiStore();
    await seed(
      store,
      (target) => target.dispatch(subscriptionsApi.endpoints.isSubscribed.initiate(CHANNEL_ID)),
      { channelId: CHANNEL_ID, subscribed }
    );

    expect(render(store, { channelId: CHANNEL_ID, isLoggedIn: true })).toContain(
      `subscribed=${subscribed} loading=false`
    );
  });
});
