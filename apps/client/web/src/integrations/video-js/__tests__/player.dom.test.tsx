import { render, screen } from '@testing-library/react';
import { usePlayer, VideoPlayer } from '../player';

function Paused() {
  const paused = usePlayer((state) => state.paused);

  return <output>{`paused:${paused}`}</output>;
}

describe('apps/client/web: the Video.js player', () => {
  it('gives its children the player state', () => {
    render(
      <VideoPlayer>
        <Paused />
      </VideoPlayer>
    );

    expect(screen.getByRole('status')).toHaveTextContent('paused:true');
  });
});
