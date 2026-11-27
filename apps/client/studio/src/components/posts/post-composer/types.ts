import type { SpriteSheet } from '@kit/components';
import type { PostKind } from '@vp/domain';

export type PostTimingChoice = 'now' | 'draft' | 'schedule';

export type ImageStatus = 'uploading' | 'ready' | 'failed';

export interface ImageDraft {
  key: string;
  fileName: string;
  previewUrl: string;
  uploadId: string | null;
  alt: string;
  status: ImageStatus;
}

export interface ShareTarget {
  id: string;
  title: string;
  durationMs: number | null;
  sprite?: SpriteSheet | undefined;
}

export interface PostDraft {
  kind: PostKind;
  text: string;
  caption: string;
  images: readonly ImageDraft[];
  question: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
  closesAt: string;
  video: ShareTarget | null;
  playlist: ShareTarget | null;
  comment: string;
  startMs: number;
  commentsEnabled: boolean;
  timing: PostTimingChoice;
  publishAt: string;
}

export type PostComposerMode = 'create' | 'edit';

export type DraftUpdate = (draft: PostDraft) => PostDraft;
