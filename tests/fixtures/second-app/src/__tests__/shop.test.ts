import { mintToken, verifyToken } from '@kit/dev-token';
import { classifyError, ErrorCodeRegistry, isRegisteredCode } from '@kit/errors';
import { Clock, EnvSource } from '@kit/runtime';
import { shopDevToken } from '../dev-token';
import { ShopErrorCodes } from '../errors';
import { ShopKeys } from '../keys';
import { SHOP_LOCALES, shopIntl } from '../locales';
import { createShopMetrics } from '../metrics';
import { createShopRegistry } from '../registry';

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
};

describe('quill shop on the extracted platform packages', () => {
  it('builds its registry from its own error codes and the node runtime', () => {
    const registry = createShopRegistry({ SHOP_REGION: 'nordics' });

    const codes = unwrap(registry.get(ErrorCodeRegistry));
    expect(codes).toBe(ShopErrorCodes);
    expect(classifyError(codes, { code: 'SHELF_FULL', message: 'full' })).toBe('transient');
    expect(classifyError(codes, { code: 'BOOK_NOT_FOUND', message: 'gone' })).toBe('permanent');
    expect(isRegisteredCode(codes, 'PAYMENT_DECLINED')).toBe(false);
    expect(unwrap(registry.get(EnvSource)).get('SHOP_REGION')).toBe('nordics');
    expect(typeof unwrap(registry.get(Clock)).now()).toBe('number');
  });

  it('formats in its two locales, one of them right to left', () => {
    expect(SHOP_LOCALES.tags.map((tag) => [tag, SHOP_LOCALES.details[tag].direction])).toEqual([
      ['fi-FI', 'ltr'],
      ['ar-EG', 'rtl'],
    ]);
    expect(unwrap(shopIntl('fi-FI').format({ type: 'number', value: 1234.5 }))).toBe('1 234,5');
    expect(unwrap(shopIntl('ar-EG').format({ type: 'number', value: 123 }))).toBe('١٢٣');
  });

  it('keys its cache under its own namespace', () => {
    expect(ShopKeys.shelf('poetry')).toBe('quill:shelf:poetry');
    expect(ShopKeys.basket('c-7')).toBe('quill:basket:c-7');
  });

  it('prefixes every default metric with its own prefix', async () => {
    const names = (await createShopMetrics().getMetricsAsJSON()).map(({ name }) => name);

    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !name.startsWith('quill_'))).toEqual([]);
  });

  it('mints and verifies dev tokens under its own issuer', () => {
    const config = shopDevToken(() => Date.UTC(2026, 0, 1));

    const payload = verifyToken(config, mintToken(config, { sub: 'reader-1', role: 'customer' }));

    expect(payload).toMatchObject({ sub: 'reader-1', iss: 'quill-local', aud: 'quill-shop' });
  });
});
