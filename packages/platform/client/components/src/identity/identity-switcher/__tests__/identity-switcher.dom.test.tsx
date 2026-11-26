import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdentitySwitcher } from '..';
import { renderWithCopy } from '../../../__tests__/render-with-copy';

const NAMES = ['Ada', 'Engines', 'Byron', 'Reads', 'Notes', 'Lab'];

function renderSwitcher({ search = false } = {}) {
  const chosen = vi.fn();
  const onOpenChange = vi.fn();
  renderWithCopy(
    <IdentitySwitcher.Root open onOpenChange={onOpenChange}>
      <IdentitySwitcher.Content title="Switch account">
        {search && <IdentitySwitcher.Search placeholder="Find" />}
        <IdentitySwitcher.List>
          <IdentitySwitcher.Group heading="Accounts">
            {NAMES.map((name) => (
              <IdentitySwitcher.Item key={name} value={name} onSelect={() => chosen(name)}>
                {name}
              </IdentitySwitcher.Item>
            ))}
          </IdentitySwitcher.Group>
        </IdentitySwitcher.List>
      </IdentitySwitcher.Content>
    </IdentitySwitcher.Root>
  );
  return { chosen, onOpenChange };
}

describe('@kit/components: IdentitySwitcher', () => {
  it('is a dialog named by its title holding the identities as a listbox, focus inside', async () => {
    renderSwitcher();

    expect(await screen.findByRole('dialog', { name: 'Switch account' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(6);
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it.each([
    { keys: '{ArrowDown}{ArrowDown}{Enter}', chosen: 'Byron' },
    { keys: '4', chosen: 'Reads' },
  ])('chooses with $keys', async ({ keys, chosen: name }) => {
    const { chosen } = renderSwitcher();
    await screen.findByRole('dialog');

    await userEvent.keyboard(keys);

    expect(chosen).toHaveBeenCalledWith(name);
  });

  it('filters by the search, where a digit is typed rather than jumped once there is text', async () => {
    const { chosen } = renderSwitcher({ search: true });

    await userEvent.type(await screen.findByPlaceholderText('Find'), 'en2');

    expect(chosen).not.toHaveBeenCalled();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    await userEvent.clear(screen.getByPlaceholderText('Find'));
    await userEvent.keyboard('2');
    expect(chosen).toHaveBeenCalledWith('Engines');
  });

  it('closes on Escape', async () => {
    const { onOpenChange } = renderSwitcher();
    await screen.findByRole('dialog');

    await userEvent.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
