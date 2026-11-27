import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountMenu } from '..';
import { renderWithCopy } from '../../__tests__/render-with-copy';

const renderMenu = () =>
  renderWithCopy(
    <AccountMenu.Root>
      <AccountMenu.Trigger initials="TC" />
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

describe('@kit/components: AccountMenu', () => {
  it('draws the initials it is given in the avatar', () => {
    renderWithCopy(
      <AccountMenu.Root>
        <AccountMenu.Trigger initials="TC" />
      </AccountMenu.Root>
    );

    expect(screen.getByRole('button', { name: 'account' })).toHaveTextContent('TCaccount');
  });

  it('opens from the avatar and lists the viewer, the pages and the way out', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'account' }));

    expect(screen.getByRole('menu')).toHaveTextContent('The Creator');
    expect(screen.getByRole('menuitem', { name: 'Upload' })).toHaveAttribute('href', '/upload');
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
    expect(await axeViolations()).toEqual([]);
  });

  it.each([
    { accent: 3 as const, ringed: true },
    { accent: undefined, ringed: false },
  ])('rings the avatar in accent $accent of the identity the tab acts as', ({ accent, ringed }) => {
    renderWithCopy(
      <AccountMenu.Root>
        <AccountMenu.Trigger initials="TC" accent={accent} />
      </AccountMenu.Root>
    );

    expect(document.querySelector('[data-slot="accent-ring"]') !== null).toBe(ringed);
  });
});
