import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { axeViolations } from '#app/__tests__/axe';
import { Label } from '../label';

function NameField() {
  return (
    <>
      <Label htmlFor="name">Name</Label>
      <input id="name" />
    </>
  );
}

describe('apps/web: Label', () => {
  it('names the control it points at and focuses it when clicked', async () => {
    render(<NameField />);

    await userEvent.click(screen.getByText('Name'));

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
  });

  it('passes axe', async () => {
    render(<NameField />);

    expect(await axeViolations()).toEqual([]);
  });
});
