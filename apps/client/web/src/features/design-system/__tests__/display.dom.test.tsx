import { screen } from '@testing-library/react';

import { axeViolations } from '#app/__tests__/axe';
import { Display } from '../display';
import { renderSection } from './render-section';

describe('apps/client/web: design system showcase, Display', () => {
  it('passes axe', async () => {
    renderSection(<Display />);

    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
    expect(await axeViolations()).toEqual([]);
  });
});
