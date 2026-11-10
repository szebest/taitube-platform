import { render, screen } from '@testing-library/react';
import { usePlayerSeek } from '../../../../../apps/client/web/src/lib/player/player-channel';
import { usePlaybackPreference } from '../../../../../apps/client/web/src/lib/preferences/device-preferences-provider';
import { WebProviders } from '../web-providers';

function Probe() {
  const [hoverPreview] = usePlaybackPreference('hoverPreview');
  const { currentTime } = usePlayerSeek();

  return <p>{`hover ${hoverPreview}, at ${currentTime()}s`}</p>;
}

describe('@vp/workbench: WebProviders', () => {
  it('gives a kit component the device preferences and the player channel the web app mounts', () => {
    render(
      <WebProviders>
        <Probe />
      </WebProviders>
    );

    expect(screen.getByText('hover true, at 0s')).toBeInTheDocument();
  });
});
