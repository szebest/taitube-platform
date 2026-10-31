import { renderHook } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { usePickWindowText } from '../use-pick-window-text';

describe('apps/client/studio: usePickWindowText', () => {
  it('writes the window as its start and end, each with date and time', () => {
    const { result } = renderHook(usePickWindowText, { wrapper: AppProviders });

    expect(
      result.current({ startsAt: '2026-11-02T09:00:00.000Z', endsAt: '2026-11-03T09:00:00.000Z' })
    ).toBe('Nov 2, 2026, 9:00 AM to Nov 3, 2026, 9:00 AM');
  });
});
