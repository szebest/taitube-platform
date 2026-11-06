import { render, screen } from '@testing-library/react';
import { ClipDetails } from '..';

describe('apps/client/web: ClipDetails', () => {
  it('names the clip and holds the actions beside each other', () => {
    render(
      <ClipDetails title="The best part">
        <button type="button">Watch the full video</button>
      </ClipDetails>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'The best part' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Watch the full video' })).toBeInTheDocument();
  });
});
