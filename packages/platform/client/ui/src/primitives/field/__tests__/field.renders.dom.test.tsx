import { render } from '@testing-library/react';
import { createRenderCounter } from '@vp/web-testing/dom';
import { Field } from '..';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';

function renderCountedField() {
  const { Counted, commitsOf } = createRenderCounter();
  const parts = (
    <>
      <Counted id="label">
        <Field.Label>Title</Field.Label>
      </Counted>
      <Counted id="hint">
        <Field.Hint>Shown on the watch page</Field.Hint>
      </Counted>
    </>
  );
  const view = render(<Field.Root>{parts}</Field.Root>, { wrapper: WithUiCopy });
  return { rerender: () => view.rerender(<Field.Root>{parts}</Field.Root>), commitsOf };
}

describe('@vp/ui: Field render count, compiled', () => {
  it.each(['label', 'hint'])(
    'commits the %s no more than at mount when the field renders again with the same props',
    (part) => {
      const { rerender, commitsOf } = renderCountedField();

      const atMount = commitsOf(part);
      rerender();
      rerender();

      expect(commitsOf(part)).toBe(atMount);
    }
  );
});
