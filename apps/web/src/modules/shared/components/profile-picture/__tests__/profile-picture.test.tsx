import { renderToStaticMarkup } from 'react-dom/server';
import { ProfilePicture } from '../profile-picture';

describe('apps/web: profile picture', () => {
  it('shows the avatar the channel has', () => {
    const markup = renderToStaticMarkup(<ProfilePicture src="http://localhost:9000/avatars/creator.png" />);

    expect(markup).toContain('src="http://localhost:9000/avatars/creator.png"');
    expect(markup).toContain('alt="profile"');
  });

  it.each([null, undefined])('leaves the frame empty for a channel with avatar %s', (src) => {
    expect(renderToStaticMarkup(<ProfilePicture src={src} />)).not.toContain('<img');
  });
});
