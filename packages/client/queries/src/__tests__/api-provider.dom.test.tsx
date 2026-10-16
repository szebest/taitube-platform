import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ApiProvider, useApi } from '../api-provider';
import { api } from '@vp/web-testing';

describe('@vp/queries: ApiProvider', () => {
  it('hands useApi the client it was given', () => {
    const { result } = renderHook(useApi, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ApiProvider api={api}>{children}</ApiProvider>
      ),
    });

    expect(result.current).toBe(api);
  });

  it('refuses useApi outside the provider, naming it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(useApi)).toThrow('useApi must be used within ApiProvider');
  });
});
