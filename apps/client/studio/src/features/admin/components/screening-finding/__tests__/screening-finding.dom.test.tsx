import { render, screen, within } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { MATCHED_VIDEO, screeningFinding } from '#app/features/admin/__tests__/screening.fixture';
import type { ScreeningFindingProps } from '../screening-finding';
import { ScreeningFinding } from '../screening-finding';

const renderFinding = (finding: ScreeningFindingProps['finding']) =>
  render(<ScreeningFinding finding={finding} />, { wrapper: AppProviders });

describe('apps/client/studio: ScreeningFinding', () => {
  it('names the reason with its score', () => {
    renderFinding(screeningFinding({ reason: 'KNOWN_REJECTED', score: 0.77 }));

    expect(screen.getByRole('region', { name: /Matches a rejected video/ })).toHaveTextContent(
      'Score 77%'
    );
  });

  it('shows the matched video with the coverage and the overlapping ranges', () => {
    renderFinding(screeningFinding({ match: { ...MATCHED_VIDEO, mirrored: true } }));
    const section = within(screen.getByRole('region', { name: /Duplicate of another video/ }));

    expect(section.getByText('The original on First Uploader')).toBeInTheDocument();
    expect(section.getByText('Mirrored copy')).toBeInTheDocument();
    expect(section.getByText('Video match 94%')).toBeInTheDocument();
    expect(section.getByText('Audio match 88%')).toBeInTheDocument();
    expect(section.getByText('In this video: 00:12 to 01:05')).toBeInTheDocument();
    expect(section.getByText('In the matched video: 00:20 to 01:13')).toBeInTheDocument();
  });

  it.each([
    {
      case: 'a same-channel match as advisory',
      match: { ...MATCHED_VIDEO, sameChannel: true },
      text: 'Same channel, so advisory only',
    },
    {
      case: 'a match that is gone',
      match: { ...MATCHED_VIDEO, title: null, channel: null },
      text: 'A video that is gone',
    },
  ])('marks $case', ({ match, text }) => {
    renderFinding(screeningFinding({ match }));

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('lists the flagged frames, the share over the threshold and the metadata hits', () => {
    renderFinding(
      screeningFinding({
        reason: 'NSFW',
        frames: [{ url: 'https://cdn.test/frame.jpg', timestampSeconds: 40, score: 0.9 }],
        flaggedShare: 0.25,
        signals: ['Too many links'],
        profanity: ['darn'],
      })
    );

    expect(screen.getByRole('img', { name: 'Frame at 00:40, score 90%' })).toHaveAttribute(
      'src',
      'https://cdn.test/frame.jpg'
    );
    expect(screen.getByText('Sampled frames over the threshold: 25%')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Metadata hits' })).toHaveTextContent('Too many links');
    expect(screen.getByText('Matched words: darn')).toBeInTheDocument();
  });
});
