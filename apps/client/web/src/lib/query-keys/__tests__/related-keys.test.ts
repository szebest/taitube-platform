import { api } from '@vp/web-testing';
import { relatedQueryOptions } from '../related-keys';

describe('apps/client/web: related queries', () => {
  it('keys the related videos by the video', () => {
    expect(relatedQueryOptions(api, 'a').queryKey).not.toEqual(
      relatedQueryOptions(api, 'b').queryKey
    );
  });
});
