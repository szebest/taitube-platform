import { clearAuthToken, readAuthToken } from '../auth-token';
import { AUTH_TOKEN_LOCAL_STORAGE_KEY } from '../config';

type FakeStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
};

function blockedStorage(): never {
  throw new DOMException('The operation is insecure.', 'SecurityError');
}

function stubStorage({ getItem = () => null, removeItem = () => {} }: Partial<FakeStorage>): void {
  vi.stubGlobal('window', { localStorage: { getItem, removeItem } });
}

describe('apps/web: auth token', () => {
  it.each<{ scenario: string; getItem: FakeStorage['getItem']; token: string | null }>([
    {
      scenario: 'the stored token',
      getItem: (key) => (key === AUTH_TOKEN_LOCAL_STORAGE_KEY ? 'stored-jwt' : null),
      token: 'stored-jwt',
    },
    { scenario: 'null when nothing is stored', getItem: () => null, token: null },
    { scenario: 'null when the storage partition is blocked', getItem: blockedStorage, token: null },
  ])('reads $scenario', ({ getItem, token }) => {
    stubStorage({ getItem });

    expect(readAuthToken()).toBe(token);
  });

  it('reads null where there is no window at all', () => {
    expect(readAuthToken()).toBeNull();
  });

  it('removes the stored token on sign-out', () => {
    const removeItem = vi.fn();
    stubStorage({ removeItem });

    clearAuthToken();

    expect(removeItem).toHaveBeenCalledWith(AUTH_TOKEN_LOCAL_STORAGE_KEY);
  });

  it('signs out quietly when the storage partition is blocked', () => {
    stubStorage({ removeItem: blockedStorage });

    expect(() => clearAuthToken()).not.toThrow();
  });
});
