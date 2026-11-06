import { render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Select } from '..';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import { Field } from '../../field';

function renderVisibilitySelect() {
  const trace: string[] = [];
  render(
    <Field.Root>
      <Field.Label>Visibility</Field.Label>
      <Select.Root
        defaultValue="public"
        onValueChange={(value) => trace.push(`value ${value}`)}
        onOpenChange={(open) => trace.push(`open ${open}`)}
      >
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="public">Public</Select.Item>
          <Select.Item value="unlisted">Unlisted</Select.Item>
          <Select.Item value="private">Private</Select.Item>
        </Select.Content>
      </Select.Root>
    </Field.Root>,
    { wrapper: WithUiCopy }
  );
  return {
    user: userEvent.setup(),
    snapshot: () => ({ dom: document.body.innerHTML, trace: [...trace] }),
  };
}

describe('@vp/ui: Select, compiled and uncompiled', () => {
  it('opens, moves and picks the same way in both builds', async () => {
    const { user, snapshot } = renderVisibilitySelect();
    const steps = [snapshot()];

    await user.tab();
    await user.keyboard('{Enter}');
    steps.push(snapshot());
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    steps.push(snapshot());

    expect(steps).toMatchSnapshot();
  });
});
