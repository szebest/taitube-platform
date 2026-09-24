import { ErrorCodes, PermanentError } from '@vp/errors';
import * as ffmpeg from '@vp/ffmpeg';

export function failTranscodeOf(rendition: string) {
  const transcode = ffmpeg.runFfmpegTranscode;
  return vi
    .spyOn(ffmpeg, 'runFfmpegTranscode')
    .mockImplementation((options) =>
      options.rendition.name === rendition
        ? Promise.reject(
            new PermanentError(ErrorCodes.FFMPEG_FAILED, `FFmpeg failed for transcode-${rendition}`)
          )
        : transcode(options)
    );
}

export function failThumbnails() {
  return vi
    .spyOn(ffmpeg, 'runFfmpegThumbnail')
    .mockRejectedValue(
      new PermanentError(ErrorCodes.FFMPEG_FAILED, 'FFmpeg failed for thumbnails')
    );
}
