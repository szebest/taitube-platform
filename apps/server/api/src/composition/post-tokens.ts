import { token } from '@kit/composition';
import type {
  PostEngagementService,
  PostManageService,
  PostRevisionService,
  PostService,
  ThreadService,
} from '../services/index';

export interface PostServiceSet {
  postService: PostService;
  postManageService: PostManageService;
  postEngagementService: PostEngagementService;
  postRevisionService: PostRevisionService;
  threadService: ThreadService;
}

export const PostServices = {
  PostService: token<PostService>('PostService'),
  PostManageService: token<PostManageService>('PostManageService'),
  PostEngagementService: token<PostEngagementService>('PostEngagementService'),
  PostRevisionService: token<PostRevisionService>('PostRevisionService'),
  ThreadService: token<ThreadService>('ThreadService'),
};
