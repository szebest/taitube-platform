import { axeViolations } from '@kit/web-testing/dom';
import { render } from '@testing-library/react';
import { PlaylistCoverSkeleton } from '../playlist-cover-skeleton';

describe('PlaylistCoverSkeleton', () => {
  it('passes axe', async () => {
    render(<PlaylistCoverSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
