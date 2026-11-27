import { render, screen } from '@testing-library/react';
import { Container } from '@videojs/react';
import { VideoPlayer } from '#app/integrations/video-js/player';
import { usePlayerContainer } from '../use-player-container';

function ContainerName() {
  const container = usePlayerContainer();

  return <output>{container?.dataset.name ?? 'none'}</output>;
}

describe('apps/client/web: usePlayerContainer', () => {
  it('is the element the player draws in', async () => {
    render(
      <VideoPlayer>
        <Container data-name="stage">
          <ContainerName />
        </Container>
      </VideoPlayer>
    );

    expect(await screen.findByText('stage')).toBeInTheDocument();
  });
});
