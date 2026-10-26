import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentProps } from 'react';

import { Field, fieldVariants } from '../field';
import { Input } from '../input';
import { variantNames } from '../lib/variant-names';

const ORIENTATIONS = variantNames(fieldVariants.variants.orientation);

function renderField(props: Partial<ComponentProps<typeof Field>> = {}) {
  return render(
    <Field label="Title" {...props}>
      <Input />
    </Field>
  );
}

describe('@vp/ui: Field', () => {
  it.each(ORIENTATIONS)('names its %s control by the label', (orientation) => {
    renderField({ orientation });

    expect(screen.getByRole('textbox', { name: 'Title' })).toBeValid();
  });

  it('describes the control with its help text', () => {
    renderField({ description: 'Shown on the watch page' });

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveAccessibleDescription(
      'Shown on the watch page'
    );
  });

  it('marks the control invalid and describes it with the error after the help text', () => {
    renderField({ description: 'Shown on the watch page', error: 'A title is required' });

    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Shown on the watch page A title is required');
  });

  it('gives each field its own ids', () => {
    renderField({ label: 'Title' });
    renderField({ label: 'Tags' });

    expect(screen.getByRole('textbox', { name: 'Title' }).id).not.toBe(
      screen.getByRole('textbox', { name: 'Tags' }).id
    );
  });

  it('passes axe', async () => {
    renderField({ description: 'Shown on the watch page', error: 'A title is required' });

    expect(await axeViolations()).toEqual([]);
  });
});
