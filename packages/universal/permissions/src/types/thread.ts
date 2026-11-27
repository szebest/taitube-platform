/** A viewer thread on a video: the video's channel decides who may pin it. */
export interface ThreadResource {
  readonly ownerId: string;
  readonly channelId: string;
  readonly authorId: string;
}
