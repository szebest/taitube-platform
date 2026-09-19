export interface CommentResource {
  readonly id?: string;
  readonly authorId?: string;
  readonly userId?: string;
  readonly videoId?: string;
  readonly videoOwnerId?: string;
}

export type CommentAction = 'comment:create' | 'comment:delete' | 'comment:pin';
