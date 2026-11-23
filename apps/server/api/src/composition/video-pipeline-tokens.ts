import { token } from '@kit/composition';
import type {
  ClipSuggestionService,
  VideoEditsService,
  VideoReplacementService,
} from '../services/index';

export interface VideoPipelineServiceSet {
  videoReplacementService: VideoReplacementService;
  videoEditsService: VideoEditsService;
  clipSuggestionService: ClipSuggestionService;
}

export const VideoPipelineServices = {
  VideoReplacementService: token<VideoReplacementService>('VideoReplacementService'),
  VideoEditsService: token<VideoEditsService>('VideoEditsService'),
  ClipSuggestionService: token<ClipSuggestionService>('ClipSuggestionService'),
};
