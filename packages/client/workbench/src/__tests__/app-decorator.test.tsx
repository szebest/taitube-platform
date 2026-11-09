import { composeStory } from '@storybook/react-vite';
import { Link } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { isSubscribedToChannel } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useAccount, useApi } from '@vp/queries';
import { useEffect, useState } from 'react';
import { type AppParameters, withApp } from '../app-decorator';
import { loadCatalogue } from '../decorator';
import { initialAppearanceGlobals } from '../toolbars';

const CHANNEL_ID = '0190c3a0-5e1d-7000-8000-00000000c001';

function Probe() {
  const api = useApi();
  const account = useAccount();
  const { tOr } = useT();
  const [subscribed, setSubscribed] = useState('loading');

  useEffect(() => {
    api.subscriptions
      .isSubscribedToChannel({ params: { id: CHANNEL_ID } })
      .then((status) => setSubscribed(String(status.subscribed)))
      .catch(() => setSubscribed('unanswered'));
  }, [api]);

  return (
    <>
      <p>{account?.user.email ?? 'guest'}</p>
      <p>{`subscribed: ${subscribed}`}</p>
      <p>{tOr('channels.viewChannel', {}, '')}</p>
      <Link to="/channel/$channelId" params={{ channelId: CHANNEL_ID }}>
        channel
      </Link>
    </>
  );
}

const renderWith = async (app: AppParameters, globals: Record<string, string> = {}) => {
  const Story = composeStory(
    { render: () => <Probe />, parameters: { app } },
    { title: 'Probe' },
    {
      decorators: [withApp],
      loaders: [loadCatalogue],
      initialGlobals: { ...initialAppearanceGlobals, ...globals },
    }
  );
  await Story.load();
  return render(<Story />);
};

describe('@vp/workbench: withApp', () => {
  it('stands the router, the session, the in-memory API and the words up around the story', async () => {
    await renderWith({
      session: 'signed-in',
      api: () => [
        {
          contract: isSubscribedToChannel,
          body: () => ({ channelId: CHANNEL_ID, subscribed: true }),
        },
      ],
    });

    expect(await screen.findByText('viewer@example.com')).toBeInTheDocument();
    expect(await screen.findByText('subscribed: true')).toBeInTheDocument();
    expect(screen.getByText('View channel')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'channel' })).toHaveAttribute(
      'href',
      `/channel/${CHANNEL_ID}`
    );
  });

  it('shows a guest unless the story signs in', async () => {
    await renderWith({});

    expect(await screen.findByText('guest')).toBeInTheDocument();
  });

  it('words the story in the toolbar locale', async () => {
    await renderWith({}, { locale: 'pl' });

    expect(await screen.findByText('Zobacz kanał')).toBeInTheDocument();
  });

  it('leaves a story that asks for no app bare', async () => {
    const Story = composeStory(
      { render: () => <p>bare</p> },
      { title: 'Probe' },
      { decorators: [withApp], loaders: [loadCatalogue] }
    );
    await Story.load();
    render(<Story />);

    expect(screen.getByText('bare')).toBeInTheDocument();
  });
});
