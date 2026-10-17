import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { IntlProvider } from '../intl-provider';
import { useFormat } from '../use-format';

function renderUseFormat(withProvider = true) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <IntlProvider locale="de" timeZone="Europe/Berlin">
      {children}
    </IntlProvider>
  );
  return renderHook(useFormat, withProvider ? { wrapper } : undefined);
}

describe('@vp/intl-react: useFormat', () => {
  it('formats in the provider locale and zone', () => {
    const { format } = renderUseFormat().result.current;

    expect(format({ type: 'time', value: '2026-09-22T18:30:00.000Z' })).toEqual({
      ok: true,
      value: '20:30',
    });
  });

  it('fails loudly outside a provider, naming it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderUseFormat(false)).toThrow('useFormat must be called inside <IntlProvider>');
  });
});
