import { token } from '@vp/composition';
import type { ScreeningService } from '../services/index';
import type { MetadataScreening } from '../services/metadata-screening';

export const ScreeningServices = {
  MetadataScreening: token<MetadataScreening>('MetadataScreening'),
  ScreeningService: token<ScreeningService>('ScreeningService'),
};
