import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { Field } from '../../field';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import type { TextareaProps } from '../textarea';
import { Textarea } from '..';

const renderTextarea = (props: TextareaProps = {}, invalid = false) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <Field.Root invalid={invalid}>
        <Field.Label>Description</Field.Label>
        <Textarea {...props} />
        {invalid && <Field.Error>Too long</Field.Error>}
      </Field.Root>,
      { wrapper: WithUiCopy }
    ),
  };
};

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

  it.each([
    { size: 'sm', rows: 2 },
    { size: 'md', rows: 3 },
    { size: 'lg', rows: 5 },
  ] as const)('is $rows rows tall at size $size', ({ size, rows }) => {
    renderTextarea({ size });

    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveAttribute(
      'rows',
      String(rows)
    );
  });

  it('passes axe', async () => {
    renderTextarea({ autoGrow: true }, true);

    expect(await axeViolations()).toEqual([]);
  });
});
