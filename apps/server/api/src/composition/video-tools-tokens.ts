import { token } from '@kit/composition';
import type {
  ChapterService,
  ExperimentOverlay,
  ShareLinkService,
  VideoAccessGate,
  VideoAccessSecrets,
  VideoBulkEditService,
  VideoCorrectionService,
  VideoExperimentService,
  VideoPasswordService,
  VideoRevisionService,
  VideoWatchService,
} from '../services/index';
import { type VideoPipelineServiceSet, VideoPipelineServices } from './video-pipeline-tokens';

export interface VideoToolsServiceSet extends VideoPipelineServiceSet {
  videoBulkEditService: VideoBulkEditService;
  videoRevisionService: VideoRevisionService;
  chapterService: ChapterService;
  videoCorrectionService: VideoCorrectionService;
  videoWatchService: VideoWatchService;
  shareLinkService: ShareLinkService;
  videoPasswordService: VideoPasswordService;
  videoExperimentService: VideoExperimentService;
}

export const VideoToolsServices = {
  ...VideoPipelineServices,
  VideoBulkEditService: token<VideoBulkEditService>('VideoBulkEditService'),
  VideoRevisionService: token<VideoRevisionService>('VideoRevisionService'),
  ChapterService: token<ChapterService>('ChapterService'),
  VideoCorrectionService: token<VideoCorrectionService>('VideoCorrectionService'),
  VideoAccessSecrets: token<VideoAccessSecrets>('VideoAccessSecrets'),
  VideoAccessGate: token<VideoAccessGate>('VideoAccessGate'),
  ExperimentOverlay: token<ExperimentOverlay>('ExperimentOverlay'),
  VideoWatchService: token<VideoWatchService>('VideoWatchService'),
  ShareLinkService: token<ShareLinkService>('ShareLinkService'),
  VideoPasswordService: token<VideoPasswordService>('VideoPasswordService'),
  VideoExperimentService: token<VideoExperimentService>('VideoExperimentService'),
};
