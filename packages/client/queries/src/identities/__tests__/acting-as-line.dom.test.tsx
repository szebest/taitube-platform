import { act, screen } from '@testing-library/react';
import { ActingAsLine } from '../acting-as-line';
import { useIdentityGuard } from '../use-identity-guard';
import { renderIdentities, type TestAccount } from './render-identities';

const ADA: TestAccount = { slot: 0, name: 'Ada' };
const BYRON: TestAccount = { slot: 1, name: 'Byron' };

const write = vi.fn();

function Composer() {
  const guard = useIdentityGuard();
  return (
    <>
      <ActingAsLine action="comment" guard={guard} />
      <button type="button" onClick={() => guard.guard(write)}>
        Post
      </button>
    </>
  );
}

describe('@vp/queries: ActingAsLine', () => {
  it('says who the comment goes out as, and its Switch opens the switcher', async () => {
    const { user } = await renderIdentities({ accounts: [ADA, BYRON], page: Composer });

    expect(await screen.findByText('Commenting as Ada')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch' }));

    expect(
      await screen.findByRole('dialog', { name: 'Switch account or channel' })
    ).toBeInTheDocument();
  });

  it('sends a write while the identity is the one drawn', async () => {
    const { user } = await renderIdentities({ accounts: [ADA, BYRON], page: Composer });

    await user.click(await screen.findByRole('button', { name: 'Post' }));

    expect(write).toHaveBeenCalledOnce();
  });

  it('holds a write fired after the identity changed, asks again, and sends it only when told', async () => {
    const { user, router } = await renderIdentities({ accounts: [ADA, BYRON], page: Composer });
    await screen.findByText('Commenting as Ada');

    act(() => {
      router.options.context.identity.switchTo({ identity: { slot: 1 }, prefixed: true });
    });
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(write).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Nothing was sent');
    await user.click(screen.getByRole('button', { name: 'Send anyway' }));
    expect(write).toHaveBeenCalledOnce();
  });

  it('draws nothing in a browser of one account and one channel', async () => {
    await renderIdentities({ accounts: [ADA], page: Composer });

    await screen.findByRole('button', { name: 'Post' });
    expect(screen.queryByText('Commenting as Ada')).not.toBeInTheDocument();
  });
});
