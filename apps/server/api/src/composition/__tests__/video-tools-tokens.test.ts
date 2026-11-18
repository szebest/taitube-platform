import { Services } from '../service-tokens';
import { VideoToolsServices } from '../video-tools-tokens';

describe('apps/server/api/composition: video tools tokens', () => {
  it('are the very tokens Services holds, so a provider registered on one resolves through the other', () => {
    expect(Services.VideoBulkEditService).toBe(VideoToolsServices.VideoBulkEditService);
    expect(Services.VideoRevisionService).toBe(VideoToolsServices.VideoRevisionService);
    expect(Services.ChapterService).toBe(VideoToolsServices.ChapterService);
    expect(Services.VideoCorrectionService).toBe(VideoToolsServices.VideoCorrectionService);
  });
});
