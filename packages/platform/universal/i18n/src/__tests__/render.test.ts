import { builtInKinds } from '../kinds';
import type { AnyMessage } from '../message';
import { renderMessage } from '../render';
import { engine, intlFor, NOW, presets } from './fixtures';

const { dt } = engine;
const kinds = new Map(builtInKinds.map((kind) => [kind.name, kind]));

function render(message: AnyMessage, args: unknown, locale = 'en', chain = [locale]) {
  const rendered = renderMessage(message, args, { intl: intlFor(locale), kinds, presets, chain });
  return rendered.ok ? rendered.value : rendered.error.code;
}

const LIKES = dt('{count:plural}', {
  plural: { count: { one: '{?} like', other: '{?} likes', formatter: 'compact' } },
});

describe('@kit/i18n: renderMessage', () => {
  it.each([
    { count: 1, expected: '1 like' },
    { count: 2, expected: '2 likes' },
    { count: 1_200_000, expected: '1.2M likes' },
  ])(
    'selects the $count branch through PluralRules, the count through its preset',
    ({ count, expected }) => {
      expect(render(LIKES, { count })).toBe(expected);
    }
  );

  it('picks among more than two categories where the locale has them', () => {
    const polish = dt('{count:plural}', {
      plural: {
        count: { one: '{?} film', few: '{?} filmy', many: '{?} filmów', other: '{?} filmu' },
      },
    });

    expect([1, 3, 5].map((count) => render(polish, { count }, 'pl'))).toEqual([
      '1 film',
      '3 filmy',
      '5 filmów',
    ]);
  });

  it.each([
    {
      token: 'number',
      message: dt('{price:number}', { number: { price: { maximumFractionDigits: 1 } } }),
      args: { price: 1234.56 },
      direct: { type: 'number', value: 1234.56, options: { maximumFractionDigits: 1 } } as const,
    },
    {
      token: 'date',
      message: dt('{when:date}', { date: { when: { style: 'long' } } }),
      args: { when: NOW },
      direct: { type: 'date', value: NOW, options: { style: 'long' } } as const,
    },
    {
      token: 'list',
      message: dt('{names:list}', { list: { names: { type: 'disjunction' } } }),
      args: { names: ['a', 'b', 'c'] },
      direct: { type: 'list', value: ['a', 'b', 'c'], options: { type: 'disjunction' } } as const,
    },
  ])('renders {x:$token} exactly as @vp/intl does on its own', ({ message, args, direct }) => {
    for (const locale of ['en', 'de', 'ar-EG']) {
      const alone = intlFor(locale).format(direct);
      expect(render(message, args, locale)).toBe(alone.ok ? alone.value : 'unreachable');
    }
  });

  it.each([
    {
      locale: 'pl',
      chain: ['pl'],
      options: { notation: 'compact', maximumFractionDigits: 0 } as const,
    },
    { locale: 'en', chain: ['en'], options: { notation: 'compact' } as const },
  ])('resolves a preset for $locale along the chain', ({ locale, chain, options }) => {
    const price = dt('{price:number}', { number: { price: 'compact' } });
    const alone = intlFor(locale).format({ type: 'number', value: 1234.5, options });

    expect(render(price, { price: 1234.5 }, locale, chain)).toBe(
      alone.ok ? alone.value : 'unreachable'
    );
  });

  it.each([
    {
      scenario: 'text and a bare number',
      args: { name: 'Ada', count: 1500 },
      expected: 'Ada has 1,500',
    },
    { scenario: 'text on its own', args: { name: 'Ada', count: 'none' }, expected: 'Ada has none' },
  ])('passes $scenario through bare placeholders', ({ args, expected }) => {
    expect(render(dt('{name} has {count}'), args)).toBe(expected);
  });

  it('labels an enum member', () => {
    const state = dt('{state:enum}', { enum: { state: { ready: 'Ready', failed: 'Failed' } } });

    expect(render(state, { state: 'ready' })).toBe('Ready');
  });

  it.each<{ scenario: string; message: AnyMessage; args: unknown; code: string }>([
    {
      scenario: 'a number for a date',
      message: dt('{when:date}'),
      args: { when: 5 },
      code: 'FORMAT_WRONG_KIND',
    },
    {
      scenario: 'text for a count',
      message: LIKES,
      args: { count: 'many' },
      code: 'FORMAT_WRONG_KIND',
    },
    {
      scenario: 'a missing argument',
      message: dt('{price:number}'),
      args: {},
      code: 'FORMAT_WRONG_KIND',
    },
    {
      scenario: 'a list for bare text',
      message: dt('{name}'),
      args: { name: ['a'] },
      code: 'FORMAT_WRONG_KIND',
    },
    {
      scenario: 'no arguments at all',
      message: dt('{name}'),
      args: undefined,
      code: 'FORMAT_WRONG_KIND',
    },
    {
      scenario: 'a plural with no branches',
      message: { template: '{count:plural}', config: {} },
      args: { count: 1 },
      code: 'FORMAT_UNRENDERABLE',
    },
    {
      scenario: 'an unlabelled enum member',
      message: { template: '{state:enum}', config: { enum: { state: {} } } },
      args: { state: 'x' },
      code: 'FORMAT_UNRENDERABLE',
    },
    {
      scenario: 'a kind the engine does not have',
      message: { template: '{price:money}', config: {} },
      args: { price: 1 },
      code: 'FORMAT_UNRENDERABLE',
    },
  ])('declines $scenario', ({ message, args, code }) => {
    expect(render(message, args)).toBe(code);
  });

  it('leaves text around and between placeholders as authored', () => {
    expect(render(dt('[{name}] and {state}!'), { name: 'x', state: 'y' })).toBe('[x] and y!');
  });
});
