import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { Input } from '../input';

function TitleField({ invalid = false }: { invalid?: boolean }) {
  return (
    <>
      <label htmlFor="title">Title</label>
      <Input id="title" aria-invalid={invalid} placeholder="Add a title" />
    </>
  );
}

describe('apps/web: Input', () => {
  it('is a text box named by its label, typed into from the keyboard', async () => {
    render(<TitleField />);

    await userEvent.tab();
    await userEvent.keyboard('Launch day');

    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input).toHaveFocus();
    expect(input).toHaveValue('Launch day');
    expect(input).toHaveClass('tw:focus-ring');
  });

  it('marks an invalid value for assistive technology', () => {
    render(<TitleField invalid />);

    expect(screen.getByRole('textbox', { name: 'Title' })).toBeInvalid();
  });

  it.each(THEMES)('passes axe in the %s theme', async (theme) => {
    render(<TitleField />);

    expect(await axeViolations(theme)).toEqual([]);
  });
});
