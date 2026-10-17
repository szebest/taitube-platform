import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';

import { Label } from '../label';

function renderNameField() {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <>
        <Label htmlFor="name">Name</Label>
        <input id="name" />
      </>
    ),
  };
}

describe('@vp/ui: Label', () => {
  it('names the control it points at and focuses it when clicked', async () => {
    const { user } = renderNameField();

    await user.click(screen.getByText('Name'));

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
  });

  it('passes axe', async () => {
    renderNameField();

    expect(await axeViolations()).toEqual([]);
  });
});
