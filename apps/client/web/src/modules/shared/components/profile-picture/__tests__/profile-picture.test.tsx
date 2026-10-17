import { renderToStaticMarkup } from 'react-dom/server';
import { ProfilePicture } from '../profile-picture';

function renderProfilePicture(src?: string | null): string {
  return renderToStaticMarkup(<ProfilePicture src={src} />);
}

describe('apps/client/web: profile picture', () => {
  it('shows the avatar the channel has', () => {
    const markup = renderProfilePicture('http://localhost:9000/avatars/creator.png');

    expect(markup).toContain('src="http://localhost:9000/avatars/creator.png"');
    expect(markup).toContain('alt="profile"');
  });

  it.each([null, undefined])('leaves the frame empty for a channel with avatar %s', (src) => {
    expect(renderProfilePicture(src)).not.toContain('<img');
  });
});
