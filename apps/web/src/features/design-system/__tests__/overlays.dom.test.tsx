import { screen } from '@testing-library/react';

import { axeViolations } from '#app/__tests__/axe';
import { Overlays } from '../overlays';
import { renderSection } from './render-section';

describe('apps/web: design system showcase, Overlays', () => {
  it('passes axe', async () => {
    renderSection(<Overlays />);

    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
    expect(await axeViolations()).toEqual([]);
  });
});
