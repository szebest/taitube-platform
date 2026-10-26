import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { variantNames } from '../../../lib/variant-names';
import { Label, type LabelProps } from '../label';
import { labelStyles } from '../label.variants';

function renderNameField(props: Partial<LabelProps> = {}) {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <>
        <Label htmlFor="name" {...props}>
          Name
        </Label>
        <input id="name" />
      </>
    ),
  };
}

describe('@vp/ui: Label', () => {
  it.each(variantNames(labelStyles.variants.size))(
    'names the control it points at and focuses it when clicked, at size %s',
    async (size) => {
      const { user } = renderNameField({ size });

      await user.click(screen.getByText('Name'));

      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    }
  );

  it('passes axe', async () => {
    renderNameField();

    expect(await axeViolations()).toEqual([]);
  });
});
