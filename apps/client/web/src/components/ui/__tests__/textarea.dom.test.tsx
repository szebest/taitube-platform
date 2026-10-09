import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { axeViolations } from '#app/__tests__/axe';
import { Field } from '../field';
import { Textarea } from '../textarea';

describe('apps/client/web: Textarea', () => {
  it('is a multi-line text box named by its field', async () => {
    render(
      <Field label="Description">
        <Textarea />
      </Field>
    );

    await userEvent.tab();
    await userEvent.keyboard('first{Enter}second');

    const textarea = screen.getByRole('textbox', { name: 'Description' });
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue('first\nsecond');
    expect(textarea).toHaveClass('tw:focus-ring');
  });

  it('passes axe', async () => {
    render(
      <Field label="Description" error="Too long">
        <Textarea />
      </Field>
    );

    expect(await axeViolations()).toEqual([]);
  });
});
