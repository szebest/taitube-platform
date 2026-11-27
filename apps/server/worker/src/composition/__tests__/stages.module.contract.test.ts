import { Container } from '@kit/composition';
import { containerProviderSubject } from '@kit/composition/contract';
import { describeProviderContract } from '@kit/di/contract';
import { createLogger, LogContext } from '@kit/logger';
import { registerAdapters } from '@vp/adapters/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { mediaTools } from '@vp/ffmpeg';
import { fingerprintTools } from '@vp/fingerprint';
import { speechTools } from '@vp/whisper';
import { registerStages } from '../stages.module';

describeProviderContract(async () =>
  containerProviderSubject(
    registerStages(await registerAdapters(new Container(), inProcessAppConfig()), {
      logger: createLogger({ format: 'json', service: 'stages-contract', level: 'silent' }),
      logContext: new LogContext(),
      media: mediaTools,
      speech: speechTools,
      fingerprint: fingerprintTools,
      workerId: 'stages-contract',
      outboxRelay: { enabled: false },
    })
  )
);
