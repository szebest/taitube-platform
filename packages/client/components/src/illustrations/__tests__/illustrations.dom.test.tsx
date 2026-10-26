import { render } from '@testing-library/react';
import * as illustrations from '..';

describe('@vp/components: illustrations', () => {
  it.each(Object.entries(illustrations))(
    'draws %s as a decorative svg that takes its colour from CSS',
    (_name, Drawing) => {
      const { container } = render(<Drawing />);

      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(container.innerHTML).toContain('currentColor');
    }
  );
});
