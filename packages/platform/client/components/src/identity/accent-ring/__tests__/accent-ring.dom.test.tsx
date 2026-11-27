import { render, screen } from '@testing-library/react';
import { AccentRing } from '..';

describe('@kit/components: AccentRing', () => {
  it.each([1, 2, 6] as const)('draws accent %i from the categorical palette', (accent) => {
    render(
      <AccentRing accent={accent} data-testid="ring">
        <span>A</span>
      </AccentRing>
    );

    expect(screen.getByTestId('ring')).toHaveClass(`ring-(color:--dataviz-categorical-${accent})`);
    expect(screen.getByTestId('ring')).toHaveTextContent('A');
  });
});
