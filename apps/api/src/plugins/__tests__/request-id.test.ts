import { requestIdFrom } from '../request-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('apps/api/plugins: requestIdFrom', () => {
  it('keeps the id an edge proxy sent', () => {
    expect(requestIdFrom({ 'x-request-id': 'edge-01:ab.c' })).toBe('edge-01:ab.c');
  });

  it.each([
    ['no header', {}],
    ['a header with a newline', { 'x-request-id': 'a\n{"level":"error"}' }],
    ['an overlong header', { 'x-request-id': 'a'.repeat(129) }],
    ['a repeated header', { 'x-request-id': ['a', 'b'] }],
  ])('generates a uuid for %s', (_name, headers) => {
    expect(requestIdFrom(headers)).toMatch(UUID);
  });
});
