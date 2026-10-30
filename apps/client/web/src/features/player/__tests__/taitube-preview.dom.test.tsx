import { render, screen, within } from '@testing-library/react';
import { IntlProvider } from '@vp/intl-react';

import { TaitubePreview } from '../taitube-preview';

describe('apps/client/web: the Taitube preview', () => {
  it('draws the player with its controls', () => {
    render(
      <IntlProvider locale="en" timeZone="UTC">
        <TaitubePreview
          playbackUrl="http://localhost:9000/public/videos/v1/hls/master.m3u8"
          title="Launch day"
          range={{ startMs: 10_000, endMs: 20_000 }}
        />
      </IntlProvider>
    );

    const player = screen.getByRole('group', { name: 'Media player' });

    expect(within(player).getByRole('group', { name: 'Player controls' })).toBeInTheDocument();
  });
});
