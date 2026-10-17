import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentProps } from 'react';

import { Field } from '../field';
import { Textarea } from '../textarea';

function renderTextarea(fieldProps: Partial<ComponentProps<typeof Field>> = {}) {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <Field label="Description" {...fieldProps}>
        <Textarea />
      </Field>
    ),
  };
}

describe('@vp/ui: Textarea', () => {
  it('is a multi-line text box named by its field', async () => {
    const { user } = renderTextarea();

    await user.tab();
    await user.keyboard('first{Enter}second');

    const textarea = screen.getByRole('textbox', { name: 'Description' });
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue('first\nsecond');
    expect(textarea).toHaveClass('tw:focus-ring');
  });

  it('passes axe', async () => {
    renderTextarea({ error: 'Too long' });

    expect(await axeViolations()).toEqual([]);
  });
});
