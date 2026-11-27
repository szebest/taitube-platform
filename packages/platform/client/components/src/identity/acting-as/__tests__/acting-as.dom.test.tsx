import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActingAs } from '..';
import { renderWithCopy } from '../../../__tests__/render-with-copy';

describe('@kit/components: ActingAs', () => {
  it('names the identity in the accent ring and opens the switcher from its button', async () => {
    const onSwitch = vi.fn();
    renderWithCopy(
      <ActingAs.Root>
        <ActingAs.Avatar name="Ada Lovelace" accent={2} />
        <ActingAs.Label>Commenting as Ada Lovelace</ActingAs.Label>
        <ActingAs.Switch onClick={onSwitch}>Switch</ActingAs.Switch>
      </ActingAs.Root>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Switch' }));

    expect(screen.getByText('Commenting as Ada Lovelace')).toBeInTheDocument();
    expect(document.querySelector('[data-accent="2"]')).toHaveTextContent('AL');
    expect(onSwitch).toHaveBeenCalledOnce();
  });
});
