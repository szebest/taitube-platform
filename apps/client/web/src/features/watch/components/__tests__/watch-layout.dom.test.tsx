import { render, screen } from '@testing-library/react';

import { WatchLayout } from '../watch-layout';

describe('apps/client/web: watch layout', () => {
  it.each([
    { scenario: 'a main column and an aside', aside: <p>Related</p>, asides: 1 },
    { scenario: 'a main column alone', aside: undefined, asides: 0 },
  ])('renders $scenario', ({ aside, asides }) => {
    render(<WatchLayout main={<p>Stage</p>} aside={aside} />);

    expect(screen.getByText('Stage')).toBeInTheDocument();
    expect(screen.queryAllByRole('complementary')).toHaveLength(asides);
  });
});
