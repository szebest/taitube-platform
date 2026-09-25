import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { IntlProvider } from '../intl-provider';
import { useFormat } from '../use-format';

describe('@vp/intl-react: useFormat', () => {
  it('formats in the provider locale and zone', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <IntlProvider locale="de" timeZone="Europe/Berlin">
        {children}
      </IntlProvider>
    );
    const { format } = renderHook(useFormat, { wrapper }).result.current;

    expect(format({ type: 'time', value: '2026-09-22T18:30:00.000Z' })).toEqual({
      ok: true,
      value: '20:30',
    });
  });

  it('fails loudly outside a provider, naming it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(useFormat)).toThrow('useFormat must be called inside <IntlProvider>');
  });
});
