import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { Field } from '..';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import { variantNames } from '../../../lib/variant-names';
import { Input } from '../../input';
import type { FieldRootProps } from '../field';
import { fieldStyles } from '../field.variants';

const renderField = (props: FieldRootProps = {}, withHint = true) =>
  render(
    <Field.Root {...props}>
      <Field.Label>Title</Field.Label>
      <Field.Control>
        <input />
      </Field.Control>
      {withHint && <Field.Hint>Shown on the watch page</Field.Hint>}
      {props.invalid && <Field.Error>A title is required</Field.Error>}
    </Field.Root>,
    { wrapper: WithUiCopy }
  );

describe('@vp/ui: Field', () => {
  it.each(variantNames(fieldStyles.variants.orientation))(
    'names its %s control by the label',
    (orientation) => {
      renderField({ orientation });

      expect(screen.getByRole('textbox', { name: 'Title' })).toBeValid();
    }
  );

  it('describes the control with the hint, then the error, and marks it invalid', async () => {
    renderField({ invalid: true });

    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Shown on the watch page A title is required');
  });

  it('says the control is required in words, not only with the asterisk', () => {
    renderField({ required: true });

    expect(screen.getByRole('textbox', { name: /^Title\s*required$/ })).toBeRequired();
  });

  it('hands its ids to a control that reads them itself', () => {
    render(
      <Field.Root>
        <Field.Label>Tags</Field.Label>
        <Input />
      </Field.Root>,
      { wrapper: WithUiCopy }
    );

    expect(screen.getByRole('textbox', { name: 'Tags' })).toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderField({ invalid: true, required: true });

    expect(await axeViolations()).toEqual([]);
  });
});
