import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { IntlProvider } from '../intl-provider';
import { useT } from '../use-t';

describe('@vp/intl-react: useT', () => {
  it('translates in the provider locale', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <IntlProvider locale="en" timeZone="UTC">
        {children}
      </IntlProvider>
    );
    const { t } = renderHook(useT, { wrapper }).result.current;

    expect(t('channels.subscribers', { count: 1 })).toEqual({ ok: true, value: '1 subscriber' });
  });

  it('fails loudly outside a provider, naming it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(useT)).toThrow('useT must be called inside <IntlProvider>');
  });
});
