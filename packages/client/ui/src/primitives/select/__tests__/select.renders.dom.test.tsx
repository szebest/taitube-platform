import { render } from '@testing-library/react';
import { createRenderCounter } from '@vp/web-testing/dom';
import { Select } from '..';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import { Field } from '../../field';

function renderCountedSelect() {
  const { Counted, commitsOf } = createRenderCounter();
  const parts = (
    <Select.Root defaultValue="public">
      <Counted id="trigger">
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
      </Counted>
      <Select.Content>
        <Select.Item value="public">Public</Select.Item>
        <Select.Item value="private">Private</Select.Item>
      </Select.Content>
    </Select.Root>
  );
  const view = render(<Field.Root>{parts}</Field.Root>, { wrapper: WithUiCopy });
  return { rerender: () => view.rerender(<Field.Root>{parts}</Field.Root>), commitsOf };
}

describe('@vp/ui: Select render count, compiled', () => {
  it('commits the trigger no more than at mount when its field renders again with the same props', () => {
    const { rerender, commitsOf } = renderCountedSelect();

    const atMount = commitsOf('trigger');
    rerender();
    rerender();

    expect(commitsOf('trigger')).toBe(atMount);
  });
});
