import { screen } from '@testing-library/react';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { Overlays } from '../overlays';
import { renderSection } from './render-section';

describe('apps/web: design system showcase, Overlays', () => {
  it.each(THEMES)('passes axe in the %s theme', async (theme) => {
    renderSection(<Overlays />);

    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
    expect(await axeViolations(theme)).toEqual([]);
  });
});
