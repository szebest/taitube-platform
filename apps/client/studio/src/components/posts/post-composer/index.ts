import { PostComposerKinds, PostComposerProblem, PostComposerRoot } from './post-composer';
import { PostComposerComments } from './post-composer-comments';
import { PostComposerImages } from './post-composer-images';
import { PostComposerPoll, PostComposerQuiz } from './post-composer-poll';
import { PostComposerSchedule } from './post-composer-schedule';
import { PostComposerPlaylist, PostComposerVideo } from './post-composer-share';
import { PostComposerText } from './post-composer-text';

export const PostComposer = {
  Root: PostComposerRoot,
  Kinds: PostComposerKinds,
  Text: PostComposerText,
  Images: PostComposerImages,
  Poll: PostComposerPoll,
  Quiz: PostComposerQuiz,
  Video: PostComposerVideo,
  Playlist: PostComposerPlaylist,
  Schedule: PostComposerSchedule,
  Comments: PostComposerComments,
  Problem: PostComposerProblem,
};
export type { PostComposerRootProps } from './post-composer';
export type { PostComposerImagesProps } from './post-composer-images';
export type { PostComposerScheduleProps } from './post-composer-schedule';
export type { PostComposerShareProps } from './post-composer-share';
export { usePostComposer } from './post-composer.context';
export { POST_LIMITS } from './constants';
export { decideDraft, type DraftProblem } from './utils/decide-draft';
export { draftOfPost, EMPTY_DRAFT, fromLocalInput, toLocalInput } from './utils/draft';
export type {
  DraftUpdate,
  ImageDraft,
  ImageStatus,
  PostComposerMode,
  PostDraft,
  PostTimingChoice,
  ShareTarget,
} from './types';
