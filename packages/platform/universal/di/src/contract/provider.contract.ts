import { err, ok, type Result } from '@kit/result';
import type { MissingProvider } from '../registry';
import { type Token, token } from '../token';

export interface ProviderSubject {
  provide<T>(wanted: Token<T>, value: T): ProviderSubject;
  resolve<T>(wanted: Token<T>): Result<T, MissingProvider>;
}

export type MakeProviderSubject = () => Promise<ProviderSubject> | ProviderSubject;

const Port = token<number>('contract.Port');
const Host = token<string>('contract.Host');

export function describeProviderContract(makeSubject: MakeProviderSubject): void {
  describe('Provider contract', () => {
    it('resolves the value provided for a token', async () => {
      const subject = (await makeSubject()).provide(Port, 8080);

      expect(subject.resolve(Port)).toEqual(ok(8080));
    });

    it('answers MissingProvider, never a throw, for a token nobody provided', async () => {
      const subject = (await makeSubject()).provide(Port, 8080);

      expect(subject.resolve(Host)).toEqual(err({ code: 'MISSING_PROVIDER', token: Host.name }));
    });

    it('resolves a token to the provider given last, so a fake replaces the real one', async () => {
      const subject = (await makeSubject()).provide(Port, 8080).provide(Port, 9090);

      expect(subject.resolve(Port)).toEqual(ok(9090));
    });

    it('keeps two tokens that share a name apart', async () => {
      const raw = token<string>('contract.Bucket');
      const published = token<string>('contract.Bucket');
      const subject = (await makeSubject()).provide(raw, 'raw').provide(published, 'public');

      expect([subject.resolve(raw), subject.resolve(published)]).toEqual([ok('raw'), ok('public')]);
    });
  });
}
