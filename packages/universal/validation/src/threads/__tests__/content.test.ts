import { isErr, isOk } from '@kit/result';
import { validateThreadContent } from '../content';

describe('@vp/validation: validateThreadContent', () => {
  it.each([
    { name: 'a title and no body', title: 'Intro', body: '' },
    { name: 'a title of 100 characters', title: 'a'.repeat(100), body: 'x' },
    { name: 'a body of 1000 characters', title: 'Intro', body: 'b'.repeat(1000) },
  ])('accepts $name', ({ title, body }) => {
    expect(isOk(validateThreadContent({ title, body }))).toBe(true);
  });

  it.each([
    { name: 'a blank title', title: '   ', body: '', field: 'title' },
    { name: 'a title of 101 characters', title: 'a'.repeat(101), body: '', field: 'title' },
    { name: 'a body of 1001 characters', title: 'Intro', body: 'b'.repeat(1001), field: 'body' },
  ])('refuses $name on $field', ({ title, body, field }) => {
    const result = validateThreadContent({ title, body });

    expect(isErr(result) && result.error.field).toBe(field);
  });

  it('trims what it keeps', () => {
    const result = validateThreadContent({ title: '  Intro ', body: ' hi ' });

    expect(isOk(result) && result.value).toEqual({ title: 'Intro', body: 'hi' });
  });
});
