import { Container } from '../container';
import { token } from '../token';

describe('packages/composition: token', () => {
  it('carries its name for messages', () => {
    expect(token<number>('Port').name).toBe('Port');
  });

  it('resolves by identity, so two tokens sharing a name never collide', () => {
    const first = token<string>('Bucket');
    const second = token<string>('Bucket');
    const c = new Container().provide(first, () => 'raw').provide(second, () => 'public');

    expect([c.get(first), c.get(second)]).toEqual(['raw', 'public']);
  });
});
