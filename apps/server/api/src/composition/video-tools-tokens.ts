import { token } from '@kit/composition';
import type {
  ChapterService,
  VideoBulkEditService,
  VideoCorrectionService,
  VideoRevisionService,
} from '../services/index';

export interface VideoToolsServiceSet {
  videoBulkEditService: VideoBulkEditService;
  videoRevisionService: VideoRevisionService;
  chapterService: ChapterService;
  videoCorrectionService: VideoCorrectionService;
}

export const VideoToolsServices = {
  VideoBulkEditService: token<VideoBulkEditService>('VideoBulkEditService'),
  VideoRevisionService: token<VideoRevisionService>('VideoRevisionService'),
  ChapterService: token<ChapterService>('ChapterService'),
  VideoCorrectionService: token<VideoCorrectionService>('VideoCorrectionService'),
};
