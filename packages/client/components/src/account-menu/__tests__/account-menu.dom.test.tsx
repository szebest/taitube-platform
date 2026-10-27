import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { renderWithCopy } from '../../__tests__/render-with-copy';
import { AccountMenu } from '..';

const renderMenu = () =>
  renderWithCopy(
    <AccountMenu.Root>
      <AccountMenu.Trigger name="The Creator" />
      <AccountMenu.Content>
        <AccountMenu.Label>The Creator</AccountMenu.Label>
        <AccountMenu.Item asChild>
          <a href="/upload">Upload</a>
        </AccountMenu.Item>
        <AccountMenu.Separator />
        <AccountMenu.Item>Sign out</AccountMenu.Item>
      </AccountMenu.Content>
    </AccountMenu.Root>
  );

describe('@vp/components: AccountMenu', () => {
  it.each([
    { name: 'The Creator', initials: 'TC' },
    { name: 'taitube', initials: 'T' },
    { name: '  Ada   Lovelace Byron ', initials: 'AL' },
    { name: '', initials: '' },
  ])('draws $name as $initials', ({ name, initials }) => {
    renderWithCopy(
      <AccountMenu.Root>
        <AccountMenu.Trigger name={name} />
      </AccountMenu.Root>
    );

    expect(screen.getByRole('button', { name: 'account' })).toHaveTextContent(`${initials}account`);
  });

  it('opens from the avatar and lists the viewer, the pages and the way out', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'account' }));

    expect(screen.getByRole('menu')).toHaveTextContent('The Creator');
    expect(screen.getByRole('menuitem', { name: 'Upload' })).toHaveAttribute('href', '/upload');
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
    expect(await axeViolations()).toEqual([]);
  });
});
