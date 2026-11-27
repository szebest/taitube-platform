import { axeViolations } from '@kit/web-testing/dom';
import { render } from '@testing-library/react';
import { PlaylistItemRowSkeleton } from '../playlist-item-row-skeleton';

describe('PlaylistItemRowSkeleton', () => {
  it('passes axe', async () => {
    render(<PlaylistItemRowSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
