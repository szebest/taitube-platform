import type { ProviderSubject } from '@kit/di/contract';
import type { Container } from '../../container';
import { containerProviderSubject } from '../../contract';

expectTypeOf(containerProviderSubject).parameters.toEqualTypeOf<[Container]>();
expectTypeOf(containerProviderSubject).returns.toEqualTypeOf<ProviderSubject>();

// @ts-expect-error the subject wraps a container, not a registry
containerProviderSubject({ get: () => 1 });
