import { isErr } from '@vp/result';
import { AnySchema, CommentSchema } from '../responses';
import { type Scenario, type ScenarioContext, actorOf, userById } from '../scenario';
import { createTally } from '../tally';
import type { CommentSpec } from '../world-types';
import { hasReply, listReplies, listRoots, sameComment } from './comment-lookup';

async function seedThread(
  context: ScenarioContext,
  spec: CommentSpec,
  tally: ReturnType<typeof createTally>
) {
  const { api, world, state } = context;
  const video = state.videos.get(spec.videoKey);
  const author = userById(world, spec.authorId);
  const owner = video && userById(world, video.spec.ownerId);
  if (!video || video.status !== 'READY' || !author || !owner) return;

  const authorActor = actorOf(author);
  const ownerActor = actorOf(owner);
  const roots = await listRoots(api, ownerActor, video.id);
  if (isErr(roots)) return tally.fail(roots.error);

  let root = roots.value.find((comment) => sameComment(comment, spec.authorId, spec.text));
  if (root) tally.existing();
  else {
    const created = await api.send(
      {
        actor: authorActor,
        method: 'POST',
        path: `/v1/videos/${video.id}/comments`,
        json: { content: spec.text },
      },
      CommentSchema
    );
    if (isErr(created)) return tally.fail(created.error);
    root = created.value;
    tally.created();
  }

  const replies = await listReplies(api, ownerActor, root.id);
  if (isErr(replies)) return tally.fail(replies.error);
  for (const reply of spec.replies) {
    const replier = userById(world, reply.authorId);
    if (!replier) continue;
    if (hasReply(replies.value, reply.authorId, reply.text)) {
      tally.existing();
      continue;
    }
    const created = await api.send(
      {
        actor: actorOf(replier),
        method: 'POST',
        path: `/v1/videos/${video.id}/comments`,
        json: { content: reply.text, parentId: root.id },
      },
      CommentSchema
    );
    if (isErr(created)) tally.fail(created.error);
    else tally.created();
  }

  for (const [wanted, done, action] of [
    [spec.pinned, root.isPinned, 'pin'],
    [spec.hearted, root.heartedByCreator, 'heart'],
  ] as const) {
    if (!wanted || done) continue;
    const marked = await api.send(
      { actor: ownerActor, method: 'POST', path: `/v1/comments/${root.id}/${action}` },
      AnySchema
    );
    if (isErr(marked)) tally.fail(marked.error);
    else tally.created();
  }
}

export const comments: Scenario = {
  name: 'comments',
  essential: false,
  needsReady: true,
  requires: [
    'GET /v1/videos/{id}/comments',
    'POST /v1/videos/{id}/comments',
    'GET /v1/comments/{id}/replies',
    'POST /v1/comments/{id}/pin',
    'POST /v1/comments/{id}/heart',
  ],
  async run(context) {
    const tally = createTally();
    for (const spec of context.world.comments) await seedThread(context, spec, tally);
    return tally.outcome('comments, replies, pins and hearts');
  },
};
