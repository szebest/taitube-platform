import { token } from '@kit/composition';
import type { PostEngagementService, PostManageService, PostService } from '../services/index';

export interface PostServiceSet {
  postService: PostService;
  postManageService: PostManageService;
  postEngagementService: PostEngagementService;
}

export const PostServices = {
  PostService: token<PostService>('PostService'),
  PostManageService: token<PostManageService>('PostManageService'),
  PostEngagementService: token<PostEngagementService>('PostEngagementService'),
};
