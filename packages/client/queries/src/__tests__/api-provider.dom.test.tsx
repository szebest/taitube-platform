import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { api } from '@vp/web-testing';

import { ApiProvider, useApi } from '../api-provider';

function renderUseApi({ provided = true } = {}) {
  return renderHook(useApi, {
    wrapper: provided
      ? ({ children }: { children: ReactNode }) => <ApiProvider api={api}>{children}</ApiProvider>
      : undefined,
  });
}

describe('@vp/queries: ApiProvider', () => {
  it('hands useApi the client it was given', () => {
    const { result } = renderUseApi();

    expect(result.current).toBe(api);
  });

  it('refuses useApi outside the provider, naming it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderUseApi({ provided: false })).toThrow(
      'useApi must be used within ApiProvider'
    );
  });
});
