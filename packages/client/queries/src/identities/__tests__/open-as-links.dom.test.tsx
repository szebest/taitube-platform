import { fireEvent, screen } from '@testing-library/react';
import { OpenAsLinks } from '../open-as-links';
import { renderIdentities, type TestAccount } from './render-identities';

const ADA: TestAccount = { slot: 0, name: 'Ada', channels: ['engines'] };
const BYRON: TestAccount = { slot: 1, name: 'Byron' };

function Links() {
  return (
    <OpenAsLinks>
      <a href="/u/0/watch/42?t=5">A video</a>
      <a href="https://elsewhere.example/">Elsewhere</a>
      <p>Plain text</p>
    </OpenAsLinks>
  );
}

const rightClick = (element: Element) => {
  fireEvent.pointerDown(element, { button: 2, pointerType: 'mouse' });
  fireEvent.contextMenu(element);
};

describe('@vp/queries: OpenAsLinks', () => {
  it('opens a link of this app in a new tab as the identity picked from its context menu', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { user } = await renderIdentities({ accounts: [ADA, BYRON], page: Links });

    await screen.findByText('A video');
    const engines = await vi.waitFor(() => {
      rightClick(screen.getByText('A video'));
      return screen.getByRole('menuitem', { name: /ENGINES/ });
    });
    expect(screen.getByText('Open as...')).toBeInTheDocument();
    await user.click(engines);

    expect(open).toHaveBeenCalledWith('/u/0/c/engines/watch/42?t=5', '_blank', 'noopener');
  });

  it.each(['Elsewhere', 'Plain text'])('leaves the browser menu on %s', async (text) => {
    await renderIdentities({ accounts: [ADA, BYRON], page: Links });

    rightClick(await screen.findByText(text));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
