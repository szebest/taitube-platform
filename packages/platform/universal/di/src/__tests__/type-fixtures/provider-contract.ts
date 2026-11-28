import type { Result } from '@kit/result';
import {
  type MakeProviderSubject,
  type ProviderSubject,
  describeProviderContract,
} from '../../contract';
import { createRegistry, provide, token } from '../../index';
import type { MissingProvider } from '../../registry';

const count = token<number>('count');
const label = token<string>('label');

declare const subject: ProviderSubject;

expectTypeOf(subject.provide(count, 1)).toEqualTypeOf<ProviderSubject>();
expectTypeOf(subject.resolve(count)).toEqualTypeOf<Result<number, MissingProvider>>();
expectTypeOf(subject.resolve(label)).toEqualTypeOf<Result<string, MissingProvider>>();
expectTypeOf<ReturnType<MakeProviderSubject>>().toEqualTypeOf<
  ProviderSubject | Promise<ProviderSubject>
>();

// @ts-expect-error a value of another type than the token carries
subject.provide(count, 'one');

// @ts-expect-error resolving takes a token, not its name
subject.resolve('count');

describeProviderContract(() => {
  let registry = createRegistry();
  const self: ProviderSubject = {
    provide: (wanted, value) => {
      registry = registry.provide(provide(wanted, value));
      return self;
    },
    resolve: (wanted) => registry.get(wanted),
  };
  return self;
});
