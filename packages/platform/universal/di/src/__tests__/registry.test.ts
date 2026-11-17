import { err, ok } from '@kit/result';
import { createRegistry, provide } from '../registry';
import { token } from '../token';

const Port = token<number>('Port');
const Host = token<string>('Host');

const registryWith = (port: number) => createRegistry().provide(provide(Port, port));

describe('@kit/di: registry', () => {
  it('returns the provided value for a token', () => {
    expect(registryWith(8080).get(Port)).toEqual(ok(8080));
  });

  it('returns MissingProvider, never throws, for a token nobody provided', () => {
    expect(registryWith(8080).get(Host)).toEqual(err({ code: 'MISSING_PROVIDER', token: 'Host' }));
  });

  it('resolves by identity, so two tokens sharing a name never collide', () => {
    const raw = token<string>('Bucket');
    const published = token<string>('Bucket');
    const registry = createRegistry().provide(provide(raw, 'raw'), provide(published, 'public'));

    expect([registry.get(raw), registry.get(published)]).toEqual([ok('raw'), ok('public')]);
  });

  it('returns a new registry from provide, the later provider winning, and leaves the first unchanged', () => {
    const first = registryWith(8080);
    const second = first.provide(provide(Port, 9090));

    expect([first.get(Port), second.get(Port)]).toEqual([ok(8080), ok(9090)]);
    expect(Object.isFrozen(first)).toBe(true);
  });
});
