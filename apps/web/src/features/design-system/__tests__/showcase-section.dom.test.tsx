import { render, screen } from '@testing-library/react';

import { ShowcaseSection } from '../showcase-section';

describe('apps/web: design system showcase section', () => {
  it('heads its examples with the primitive it shows', () => {
    render(
      <ShowcaseSection title="Badge">
        <span>READY</span>
      </ShowcaseSection>
    );

    expect(screen.getByRole('region', { name: 'Badge' })).toHaveTextContent('READY');
  });
});
