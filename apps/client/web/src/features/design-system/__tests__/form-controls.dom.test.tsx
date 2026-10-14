import { screen } from '@testing-library/react';

import { axeViolations } from '#app/__tests__/axe';
import { FormControls } from '../form-controls';
import { renderSection } from './render-section';

describe('apps/client/web: design system showcase, FormControls', () => {
  it('passes axe', async () => {
    renderSection(<FormControls />);

    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
    expect(await axeViolations()).toEqual([]);
  });
});
