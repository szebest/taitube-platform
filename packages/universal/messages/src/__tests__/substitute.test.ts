import { type Params, dt } from '../define';
import { placeholders, substitute } from '../substitute';
import { NOW, intlFor } from './fixtures';

const LIKES = dt('{count:plural}', {
  plural: { count: { one: '{?} like', other: '{?} likes', formatter: { notation: 'compact' } } },
});

function render(
  message: Parameters<typeof substitute>[0],
  args: Record<string, unknown>,
  locale = 'en'
) {
  const rendered = substitute(message, args, intlFor(locale));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@vp/messages: substitute', () => {
  it.each([
    { count: 1, expected: '1 like' },
    { count: 2, expected: '2 likes' },
    { count: 1_200_000, expected: '1.2M likes' },
  ])('selects the $count branch through PluralRules', ({ count, expected }) => {
    expect(render(LIKES, { count })).toBe(expected);
  });

  it('picks among more than two categories where the locale has them', () => {
    const polish = dt('{n:plural}', {
      plural: { n: { one: '{?} film', few: '{?} filmy', many: '{?} filmów', other: '{?} filmu' } },
    });

    expect([1, 3, 5].map((n) => render(polish, { n }, 'pl'))).toEqual([
      '1 film',
      '3 filmy',
      '5 filmów',
    ]);
  });

  it.each([
    {
      token: 'number',
      message: dt('{n:number}', { number: { n: { maximumFractionDigits: 1 } } }),
      args: { n: 1234.56 },
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
    {
      token: 'plural',
      message: LIKES,
      args: { count: 12_345 },
      direct: { type: 'count', value: 12_345 } as const,
    },
  ])('renders {x:$token} exactly as the formatter does on its own', ({ message, args, direct }) => {
    for (const locale of ['en', 'de', 'ar-EG']) {
      const alone = intlFor(locale).format(direct);
      expect(render(message, args, locale)).toContain(alone.ok ? alone.value : 'unreachable');
    }
  });

  it.each([
    {
      scenario: 'text and a bare number',
      args: { who: 'Ada', n: 1500 },
      expected: 'Ada has 1,500',
    },
    { scenario: 'text on its own', args: { who: 'Ada', n: 'none' }, expected: 'Ada has none' },
  ])('passes $scenario through untyped placeholders', ({ args, expected }) => {
    expect(render(dt('{who} has {n}'), args)).toBe(expected);
  });

  it('labels an enum member', () => {
    const status = dt('{state:enum}', { enum: { state: { ready: 'Ready', failed: 'Failed' } } });

    expect(render(status, { state: 'ready' })).toBe('Ready');
  });

  it.each([
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
      message: dt('{n:number}'),
      args: {},
      code: 'FORMAT_WRONG_KIND',
    },
    {
      scenario: 'a list of numbers',
      message: dt('{xs:list}'),
      args: { xs: [1] },
      code: 'FORMAT_WRONG_KIND',
    },
    {
      scenario: 'a plural with no branches',
      message: dt('{n:plural}'),
      args: { n: 1 },
      code: 'FORMAT_UNRENDERABLE',
    },
    {
      scenario: 'an unlabelled enum member',
      message: dt('{s:enum}'),
      args: { s: 'x' },
      code: 'FORMAT_UNRENDERABLE',
    },
    {
      scenario: 'an unknown token type',
      message: dt('{n:money}'),
      args: { n: 1 },
      code: 'FORMAT_UNRENDERABLE',
    },
  ])('declines $scenario', ({ message, args, code }) => {
    expect(render(message, args)).toBe(code);
  });

  it('leaves text around and between placeholders as authored', () => {
    expect(render(dt('[{a}] and {b}!'), { a: 'x', b: 'y' })).toBe('[x] and y!');
  });

  it('reads the same placeholder names at runtime as Params does at compile time', () => {
    const template = 'Hi {name}, {count:plural} new in {names:list} since {when:date}';
    const args: Params<typeof template> = { name: 'Ada', count: 1, names: [], when: NOW };

    expect(placeholders(template).map(({ name }) => name)).toEqual(Object.keys(args));
    expect(placeholders(template).map(({ kind }) => kind)).toEqual([
      undefined,
      'plural',
      'list',
      'date',
    ]);
  });
});
