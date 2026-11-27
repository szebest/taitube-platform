import { token } from '@kit/composition';
import type { PostService } from '../services/index';

export interface PostServiceSet {
  postService: PostService;
}

export const PostServices = {
  PostService: token<PostService>('PostService'),
};
