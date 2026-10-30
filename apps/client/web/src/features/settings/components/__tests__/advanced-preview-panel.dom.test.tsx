import { render, screen, within } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { AdvancedPreviewPanel } from '../advanced-preview-panel';

const renderPanel = () => render(<AdvancedPreviewPanel />, { wrapper: AppProviders });

describe('apps/client/web: the advanced preview panel', () => {
  it('shows a shelf of three videos and a watch header, under one heading', () => {
    renderPanel();

    const panel = screen.getByRole('complementary', { name: 'Preview' });

    expect(within(panel).getByRole('heading', { name: 'Up next' })).toBeInTheDocument();
    expect(within(panel).getAllByRole('listitem')).toHaveLength(3);
    expect(
      within(panel).getByRole('heading', { name: 'A walk through the old town' })
    ).toBeInTheDocument();
    expect(within(panel).getByText('Wandering Lines')).toBeInTheDocument();
  });
});
