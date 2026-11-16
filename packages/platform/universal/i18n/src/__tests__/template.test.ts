import { placeholders } from '../template';

describe('@kit/i18n: placeholders', () => {
  it.each([
    { template: 'no placeholders', expected: [] },
    { template: 'Hi {name}', expected: [{ name: 'name', kind: undefined, start: 3, end: 9 }] },
    { template: '{n:number}!', expected: [{ name: 'n', kind: 'number', start: 0, end: 10 }] },
    { template: '{a:b:c}', expected: [{ name: 'a', kind: 'b:c', start: 0, end: 7 }] },
    { template: 'x{a{b}', expected: [{ name: 'a{b', kind: undefined, start: 1, end: 6 }] },
  ])('reads $template as ParseTemplate does', ({ template, expected }) => {
    expect(placeholders(template)).toEqual(expected);
  });

  it('reads every placeholder in order', () => {
    expect(placeholders('{a} and {b:list}').map(({ name }) => name)).toEqual(['a', 'b']);
  });
});
