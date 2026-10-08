import { render, screen } from '@testing-library/react';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { variantNames } from '#app/__tests__/variant-names';
import { Field, fieldVariants } from '../field';
import { Input } from '../input';

const ORIENTATIONS = variantNames(fieldVariants.variants.orientation);

describe('apps/web: Field', () => {
  it.each(ORIENTATIONS)('names its %s control by the label', (orientation) => {
    render(
      <Field label="Title" orientation={orientation}>
        <Input />
      </Field>
    );

    expect(screen.getByRole('textbox', { name: 'Title' })).toBeValid();
  });

  it('describes the control with its help text', () => {
    render(
      <Field label="Title" description="Shown on the watch page">
        <Input />
      </Field>
    );

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveAccessibleDescription(
      'Shown on the watch page'
    );
  });

  it('marks the control invalid and describes it with the error after the help text', () => {
    render(
      <Field label="Title" description="Shown on the watch page" error="A title is required">
        <Input />
      </Field>
    );

    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Shown on the watch page A title is required');
  });

  it('gives each field its own ids', () => {
    render(
      <>
        <Field label="Title">
          <Input />
        </Field>
        <Field label="Tags">
          <Input />
        </Field>
      </>
    );

    expect(screen.getByRole('textbox', { name: 'Title' }).id).not.toBe(
      screen.getByRole('textbox', { name: 'Tags' }).id
    );
  });

  it.each(THEMES)('passes axe in the %s theme', async (theme) => {
    render(
      <Field label="Title" description="Shown on the watch page" error="A title is required">
        <Input />
      </Field>
    );

    expect(await axeViolations(theme)).toEqual([]);
  });
});
