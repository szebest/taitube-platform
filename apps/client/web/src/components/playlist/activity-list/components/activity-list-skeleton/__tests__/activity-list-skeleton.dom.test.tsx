import { axeViolations } from '@kit/web-testing/dom';
import { render } from '@testing-library/react';
import { ActivityListSkeleton } from '../activity-list-skeleton';

describe('ActivityListSkeleton', () => {
  it('passes axe', async () => {
    render(<ActivityListSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
