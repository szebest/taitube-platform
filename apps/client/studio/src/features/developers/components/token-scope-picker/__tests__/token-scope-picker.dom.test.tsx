import { render, screen } from '@testing-library/react';
import { API_SCOPES } from '@vp/domain';
import { AppProviders } from '#app/__tests__/providers';
import { TokenScopePicker } from '../token-scope-picker';

describe('apps/client/studio: TokenScopePicker', () => {
  it('offers every scope once, under the group of what it touches', () => {
    render(
      <AppProviders>
        <TokenScopePicker value={['comments:moderate']} onValueChange={vi.fn()} />
      </AppProviders>
    );

    expect(screen.getAllByRole('checkbox')).toHaveLength(API_SCOPES.length);
    for (const scope of API_SCOPES) {
      expect(screen.getAllByText(scope)).toHaveLength(1);
    }
    expect(screen.getByRole('group', { name: 'Comments' })).toContainElement(
      screen.getByRole('checkbox', { name: 'Moderate comments' })
    );
    expect(screen.getByRole('checkbox', { name: 'Moderate comments' })).toBeChecked();
  });
});
