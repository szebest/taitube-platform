import { axeViolations } from '@kit/web-testing/dom';
import { render } from '@testing-library/react';
import { QueueSkeleton } from '../queue-skeleton';

describe('QueueSkeleton', () => {
  it('passes axe', async () => {
    render(<QueueSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
