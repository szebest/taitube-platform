import { axeViolations } from '@kit/web-testing/dom';
import { render } from '@testing-library/react';
import { CollaboratorListSkeleton } from '../collaborator-list-skeleton';

describe('CollaboratorListSkeleton', () => {
  it('passes axe', async () => {
    render(<CollaboratorListSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
