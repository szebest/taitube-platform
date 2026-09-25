import { expectOk } from '@vp/testing/result';
import { publicVideo } from '../../../__tests__/contract/fixtures';
import { inMemorySubject } from '../../../__tests__/contract/subjects';
import { describeVideoRepositoryContract } from '../../../__tests__/contract/video-repository.contract';
import { InMemoryVideoRepository } from '../in-memory-video-repository';

describeVideoRepositoryContract(inMemorySubject);

describe('InMemoryVideoRepository', () => {
  it('adds views to a video and ignores one it does not hold', async () => {
    const videos = new InMemoryVideoRepository();
    const video = expectOk(await videos.create(publicVideo({ id: 'video-1' })));

    videos.addViews(video.id, 3);
    videos.addViews(video.id, 2);
    videos.addViews('absent', 7);

    expect(expectOk(await videos.findById(video.id))?.viewsCount).toBe(5);
    expect(videos.getAllVideos()).toHaveLength(1);
  });
});
