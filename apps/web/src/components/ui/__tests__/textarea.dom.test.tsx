import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { Textarea } from '../textarea';

function DescriptionField() {
  return (
    <>
      <label htmlFor="description">Description</label>
      <Textarea id="description" />
    </>
  );
}

describe('apps/web: Textarea', () => {
  it('is a multi-line text box named by its label', async () => {
    render(<DescriptionField />);

    await userEvent.tab();
    await userEvent.keyboard('first{Enter}second');

    const textarea = screen.getByRole('textbox', { name: 'Description' });
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue('first\nsecond');
    expect(textarea).toHaveClass('tw:focus-ring');
  });

  it.each(THEMES)('passes axe in the %s theme', async (theme) => {
    render(<DescriptionField />);

    expect(await axeViolations(theme)).toEqual([]);
  });
});
