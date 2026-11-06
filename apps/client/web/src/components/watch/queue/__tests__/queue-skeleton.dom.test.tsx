import { render } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { QueueSkeleton } from '../queue-skeleton';

describe('QueueSkeleton', () => {
  it('passes axe', async () => {
    render(<QueueSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
