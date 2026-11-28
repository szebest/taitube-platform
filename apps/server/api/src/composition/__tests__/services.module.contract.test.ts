import { Container } from '@kit/composition';
import { containerProviderSubject } from '@kit/composition/contract';
import { describeProviderContract } from '@kit/di/contract';
import { registerAdapters } from '@vp/adapters/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { registerServices } from '../services.module';

describeProviderContract(async () =>
  containerProviderSubject(
    registerServices(await registerAdapters(new Container(), inProcessAppConfig()))
  )
);
