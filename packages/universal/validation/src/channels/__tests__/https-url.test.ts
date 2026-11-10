import { isHttpsUrl } from '../https-url';

describe('validation/channels: https url', () => {
  it.each([
    { value: 'https://example.com', expected: true },
    { value: 'https://example.com/a?b=1#c', expected: true },
    { value: 'http://example.com', expected: false },
    { value: 'javascript:alert(1)', expected: false },
    { value: 'https://user:pass@example.com', expected: false },
    { value: 'https://user@example.com', expected: false },
    { value: 'example.com', expected: false },
    { value: '', expected: false },
  ])('judges $value as $expected', ({ value, expected }) => {
    expect(isHttpsUrl(value)).toBe(expected);
  });
});
