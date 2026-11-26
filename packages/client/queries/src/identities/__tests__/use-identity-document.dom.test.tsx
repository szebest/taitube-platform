import { act } from '@testing-library/react';
import { useIdentityDocument } from '../use-identity-document';
import { renderIdentities, type TestAccount } from './render-identities';

const ADA: TestAccount = { slot: 0, name: 'Ada' };
const BYRON: TestAccount = { slot: 1, name: 'Byron' };

function Document() {
  useIdentityDocument();
  return null;
}

function addIcon() {
  const icon = document.createElement('link');
  icon.rel = 'icon';
  icon.type = 'image/svg+xml';
  icon.href = '/favicon.svg';
  document.head.append(icon);
  onTestFinished(() => icon.remove());
  return icon;
}

describe('@vp/queries: useIdentityDocument', () => {
  it('prefixes the title with the handle and dots the icon of a tab off the default identity', async () => {
    const icon = addIcon();
    document.title = 'Page - Taitube';
    const { router } = await renderIdentities({ accounts: [ADA, BYRON], page: Document });

    // oxlint-disable-next-line unicorn/no-document-cookie -- another tab made slot 1 the default.
    document.cookie = `vp.accounts=${encodeURIComponent(
      JSON.stringify({ defaultSlot: 1, slots: [] })
    )}; path=/`;
    await act(() => router.invalidate());
    await act(() => router.options.context.identity.queryClient().invalidateQueries());

    await vi.waitFor(() => expect(document.title).toBe('@ada - Page - Taitube'));
    await vi.waitFor(() => expect(icon.href).toMatch(/^data:image\/svg\+xml,.*circle/));
    act(() => {
      document.title = 'Next - Taitube';
    });
    await vi.waitFor(() => expect(document.title).toBe('@ada - Next - Taitube'));
  });

  it('leaves the title and icon of a tab on the default identity alone', async () => {
    const icon = addIcon();
    document.title = 'Page - Taitube';

    await renderIdentities({ accounts: [ADA, BYRON], page: Document });

    expect(document.title).toBe('Page - Taitube');
    expect(icon.getAttribute('href')).toBe('/favicon.svg');
  });
});
