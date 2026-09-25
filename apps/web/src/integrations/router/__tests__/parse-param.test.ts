import { isNotFound } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { VIDEO_ID } from '../../../__tests__/fixtures';
import { parseParam } from '../parse-param';

const VideoId = VideoIdParamSchema.shape.id;

describe('apps/web: parseParam', () => {
  it('passes a segment its schema accepts', () => {
    expect(parseParam(VideoId, VIDEO_ID)).toBe(VIDEO_ID);
  });

  it('throws not-found for a segment its schema refuses', () => {
    const thrown = (() => {
      try {
        parseParam(VideoId, 'not-a-uuid');
      } catch (error) {
        return error;
      }
    })();

    expect(isNotFound(thrown)).toBe(true);
  });
});
