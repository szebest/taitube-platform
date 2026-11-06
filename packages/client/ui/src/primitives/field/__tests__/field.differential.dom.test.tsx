import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Field } from '..';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';

function renderTitleField() {
  const trace: string[] = [];
  const field = (invalid: boolean) => (
    <Field.Root invalid={invalid} required>
      <Field.Label>Title</Field.Label>
      <Field.Control>
        <input onChange={(event) => trace.push(`change ${event.target.value}`)} />
      </Field.Control>
      <Field.Hint>Shown on the watch page</Field.Hint>
      {invalid && <Field.Error>A title is required</Field.Error>}
    </Field.Root>
  );
  const view = render(field(false), { wrapper: WithUiCopy });
  const snapshot = () => ({ dom: document.body.innerHTML, trace: [...trace] });
  return { user: userEvent.setup(), snapshot, invalidate: () => view.rerender(field(true)) };
}

describe('@vp/ui: Field, compiled and uncompiled', () => {
  it('renders, takes input and shows its error the same way in both builds', async () => {
    const { user, snapshot, invalidate } = renderTitleField();
    const steps = [snapshot()];

    await user.type(screen.getByRole('textbox', { name: /Title/ }), 'Lx');
    steps.push(snapshot());
    invalidate();
    steps.push(snapshot());

    expect(steps).toMatchSnapshot();
  });
});
