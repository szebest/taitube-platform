import { IntlProvider } from '@vp/intl-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { video } from '../../../../../__tests__/fixtures';
import { VideoDescription } from '../video-description';

const NOW = '2026-03-10T12:00:00.000Z';
const FAMILY = '👨‍👩‍👧‍👦';
const COMBINING_ACUTE = '\u0301';

function renderDescription(description: string, createdAt = NOW): string {
  return renderToStaticMarkup(
    <IntlProvider locale="en-GB" timeZone="UTC" now={NOW}>
      <VideoDescription video={video({ description, createdAt })} />
    </IntlProvider>
  );
}

describe('apps/web: video description', () => {
  it('says how long ago the video was published, with the exact time as its title', () => {
    const anHourAgo = new Date(Date.parse(NOW) - 60 * 60_000).toISOString();

    const markup = renderDescription('', anHourAgo);

    expect(markup).toContain('1 hour ago');
    expect(markup).toMatch(/title="10 Mar(ch)? 2026(,| at) 11:00"/);
  });

  it('shows a short description whole', () => {
    expect(renderDescription('Short and sweet')).toContain('Short and sweet');
  });

  it('cuts a long description at 255 graphemes until the viewer asks for more', () => {
    const markup = renderDescription(`${'a'.repeat(255)}THE REST`);

    expect(markup).toContain(`${'a'.repeat(254)}…`);
    expect(markup).not.toContain('THE REST');
    expect(markup).toContain('Show more');
  });

  it.each([
    {
      scenario: 'an emoji sequence',
      description: `${'a'.repeat(253)}${FAMILY}${FAMILY}${FAMILY}`,
      expected: `${'a'.repeat(253)}${FAMILY}…`,
    },
    {
      scenario: 'a combining mark',
      description: `${'a'.repeat(254)}e${COMBINING_ACUTE}${'b'.repeat(10)}`,
      expected: `${'a'.repeat(254)}…`,
    },
  ])('never splits $scenario the way a UTF-16 substring did', ({ description, expected }) => {
    const markup = renderDescription(description);

    expect(markup).not.toContain(`>${description.substring(0, 255)}<`);
    expect(markup).toContain(`>${expected}<`);
  });
});
