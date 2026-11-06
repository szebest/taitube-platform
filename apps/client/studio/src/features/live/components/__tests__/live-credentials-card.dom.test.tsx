import { screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import {
  liveStream,
  OVERLAY_TOKEN,
  STREAM_KEY,
} from '#app/features/live/__tests__/live-api.fixture';
import { renderLive } from '#app/features/live/__tests__/render-live';
import { LiveCredentialsCard } from '../live-credentials-card';

function renderCredentials() {
  const { ingest } = liveStream();
  if (!ingest) {
    throw new Error('the fixture stream has an ingest');
  }
  return renderLive(<LiveCredentialsCard ingest={ingest} />);
}

describe('apps/client/studio: LiveCredentialsCard', () => {
  it('shows the server URL and masks the stream key until it is revealed', async () => {
    const { user } = renderCredentials();

    expect(screen.getByLabelText('Server URL')).toHaveValue('rtmp://localhost:1935/live');
    expect(screen.getByLabelText('Stream key')).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Reveal Stream key' }));
    expect(screen.getByLabelText('Stream key')).toHaveValue(STREAM_KEY);
    expect(screen.getByLabelText('Stream key')).toHaveAttribute('type', 'text');
  });

  it.each([
    { widget: 'chat', label: 'Chat overlay URL' },
    { widget: 'alerts', label: 'Alerts overlay URL' },
    { widget: 'goal', label: 'Subscriber goal overlay URL' },
  ])('gives the $widget OBS browser source on this studio origin', ({ widget, label }) => {
    renderCredentials();

    expect(screen.getByLabelText(label)).toHaveValue(
      `${window.location.origin}/live/overlay/${OVERLAY_TOKEN}?widget=${widget}`
    );
  });

  it('copies a field and says which one', async () => {
    const { user } = renderCredentials();

    await user.click(screen.getByRole('button', { name: 'Copy Server URL' }));

    expect(await navigator.clipboard.readText()).toBe('rtmp://localhost:1935/live');
    expect(await screen.findByText('Copied: Server URL')).toBeInTheDocument();
  });

  it('masks the companion control token too', () => {
    renderCredentials();

    expect(screen.getByLabelText('Companion control token')).toHaveAttribute('type', 'password');
  });

  it('passes axe', async () => {
    renderCredentials();

    expect(await axeViolations()).toEqual([]);
  });
});
