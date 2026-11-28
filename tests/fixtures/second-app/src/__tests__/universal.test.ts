import { DEFAULT_MODE, MODE_OPTIONS } from '@kit/appearance';
import { contrastRatio, deriveAccent } from '@kit/design-tokens';
import { isMachine, machineFindings, toMermaid } from '@kit/machine';
import { Base64UrlCursorCodec, Paginator } from '@kit/pagination';
import { assertCan } from '@kit/permissions';
import { MS_PER_DAY, SECONDS_PER_HOUR } from '@kit/primitives';
import { all, andThen, err, isErr, ok, parseJson, tryCatch } from '@kit/result';
import { normalizePlainText, withinLength } from '@kit/validation';
import { abilityFor, orderMachine, shelfFailures } from '../shop-rules';

describe('quill shop on the universal platform packages', () => {
  it.each([
    { scenario: 'a day in milliseconds', actual: MS_PER_DAY, expected: 86_400_000 },
    { scenario: 'an hour in seconds', actual: SECONDS_PER_HOUR, expected: 3600 },
  ])('counts $scenario from @kit/primitives', ({ actual, expected }) => {
    expect(actual).toBe(expected);
  });

  it('offers its own appearance choice from the shared modes', () => {
    expect(MODE_OPTIONS).toContain(DEFAULT_MODE);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    const accent = deriveAccent('#8a4b2a', 'light');
    expect(accent.ok && accent.value.accent).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('composes results the way every rule of the shop does', () => {
    const parsed = andThen(parseJson('{"copies":3}'), (value) => ok(value));

    expect(parsed).toEqual(ok({ copies: 3 }));
    expect(all([ok(1), err('SHELF_FULL'), ok(3)])).toEqual(err('SHELF_FULL'));
    expect(isErr(tryCatch(() => JSON.parse('{'), String))).toBe(true);
  });

  it('measures and rejects shelf names with its own failure code', () => {
    const bounds = { minLength: 2, maxLength: 12 };

    expect(normalizePlainText('  Runot  ')).toBe('Runot');
    expect(withinLength('Runot', bounds)).toBe(true);
    expect(shelfFailures.invalidLength('shelf', bounds)).toMatchObject({
      code: 'SHELF_FULL',
      field: 'shelf',
      ...bounds,
    });
  });

  it('pages its catalogue with cursors the app never has to read', () => {
    const paginator = new Paginator({ defaultLimit: 2, maxLimit: 5 });
    const rows = [{ isbn: 'a' }, { isbn: 'b' }, { isbn: 'c' }];

    const page = paginator.paginate(rows, 2, {
      cursorOf: ({ isbn }) => ({ isbn }),
      toItem: ({ isbn }) => isbn,
    });

    expect(page.items).toEqual(['a', 'b']);
    expect(new Base64UrlCursorCodec().decode(page.nextCursor ?? '')).toEqual(ok({ isbn: 'b' }));
  });

  it('lets only its own booksellers restock', () => {
    const bookseller = { id: 'k-1', role: 'bookseller' };
    const guest = { id: 'g-1', role: 'guest' };

    expect(abilityFor(guest).can('browse', 'Shelf')).toBe(true);
    expect(abilityFor(guest).can('restock', 'Shelf')).toBe(false);
    expect(abilityFor(bookseller).can('restock', 'Shelf')).toBe(true);
    expect(() =>
      assertCan(false, { action: 'restock', subject: 'Shelf', user: guest })
    ).toThrow();
  });

  it('runs its order lifecycle on a machine of its own states', () => {
    expect(isMachine(orderMachine)).toBe(true);
    expect(machineFindings(orderMachine)).toEqual([]);
    expect(orderMachine.next('basket', 'pay')).toBe('paid');
    expect(orderMachine.next('shipped', 'pay')).toBeUndefined();
    expect(toMermaid(orderMachine)).toContain('paid');
  });
});
