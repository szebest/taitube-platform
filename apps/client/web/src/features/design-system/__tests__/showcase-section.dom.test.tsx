import { render, screen } from '@testing-library/react';

import { ShowcaseSection } from '../showcase-section';

function renderShowcaseSection() {
  return render(
    <ShowcaseSection title="Badge">
      <span>READY</span>
    </ShowcaseSection>
  );
}

describe('apps/client/web: design system showcase section', () => {
  it('heads its examples with the primitive it shows', () => {
    renderShowcaseSection();

    expect(screen.getByRole('region', { name: 'Badge' })).toHaveTextContent('READY');
  });
});
