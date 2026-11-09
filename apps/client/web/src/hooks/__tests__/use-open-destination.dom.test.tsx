import { renderHook } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { STUDIO_URL } from '#app/lib/config';
import { useOpenDestination } from '../use-open-destination';

const navigate = vi.fn();

vi.mock(import('@tanstack/react-router'), async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));

describe('apps/client/web: use open destination', () => {
  it.each([
    { target: { kind: 'page', to: '/shorts' } as const, expected: { to: '/shorts' } },
    {
      target: { kind: 'channel', channelId: 'c1' } as const,
      expected: { to: '/channel/$channelId', params: { channelId: 'c1' } },
    },
  ])('navigates to a $target.kind destination', ({ target, expected }) => {
    const { result } = renderHook(useOpenDestination, { wrapper: AppProviders });

    result.current(target);

    expect(navigate).toHaveBeenCalledWith(expected);
  });

  it('leaves the app for the studio', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const { result } = renderHook(useOpenDestination, { wrapper: AppProviders });

    result.current({ kind: 'studio' });

    expect(assign).toHaveBeenCalledWith(STUDIO_URL);
  });
});
