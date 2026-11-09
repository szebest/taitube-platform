import { render, screen } from '@testing-library/react';
import { AppWords } from '../app-words';
import { RoutePending } from '../route-pending';

describe('@vp/queries: RoutePending', () => {
  it('renders the loading status', () => {
    render(
      <AppWords>
        <RoutePending />
      </AppWords>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });
});
