import { renderHook } from '@testing-library/react';
import { createIntl, createIntlCache } from '@vp/intl';
import { createTranslator, en } from '@vp/messages';
import type { ReactNode } from 'react';
import { IntlContext, useIntlBindings } from '../intl-context';

describe('@vp/intl-react: useIntlBindings', () => {
  it('hands back what the context holds', () => {
    const intl = createIntl({ locale: 'en', timeZone: 'UTC', cache: createIntlCache() });
    const bindings = { intl, translator: createTranslator({ intl, catalogues: { en } }) };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <IntlContext.Provider value={bindings}>{children}</IntlContext.Provider>
    );

    expect(renderHook(() => useIntlBindings('probe'), { wrapper }).result.current).toBe(bindings);
  });

  it('names the calling hook when there is no provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useIntlBindings('useProbe'))).toThrow(
      'useProbe must be called inside <IntlProvider>'
    );
  });
});
