import { render, screen } from '@testing-library/react';
import { AppWords } from '../app-words';
import { RoutePending } from '../route-pending';
import { SPEC_MESSAGES } from './spec-messages';

describe('@vp/queries: RoutePending', () => {
  it('renders the loading status', () => {
    render(
      <AppWords messages={SPEC_MESSAGES}>
        <RoutePending />
      </AppWords>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });
});
