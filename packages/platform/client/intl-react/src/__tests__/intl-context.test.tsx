import { createIntl, createIntlCache } from '@kit/intl';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { type IntlBindings, IntlContext, useIntlBindings } from '../intl-context';

function renderBindings(hookName: string, bindings?: IntlBindings) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <IntlContext value={bindings}>{children}</IntlContext>
  );
  return renderHook(() => useIntlBindings(hookName), bindings ? { wrapper } : undefined);
}

describe('@kit/intl-react: useIntlBindings', () => {
  it('hands back what the context holds', () => {
    const intl = createIntl({ locale: 'en', timeZone: 'UTC', cache: createIntlCache() });
    const bindings = { intl };

    expect(renderBindings('probe', bindings).result.current).toBe(bindings);
  });

  it('names the calling hook when there is no provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderBindings('useProbe')).toThrow(
      'useProbe must be called inside <IntlProvider>'
    );
  });
});
