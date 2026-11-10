import { isErr } from '@vp/result';
import { AnySchema } from '../responses';
import { type Scenario, actorOf, userById } from '../scenario';
import { createTally } from '../tally';
import { findRoot } from './comment-lookup';

export const reports: Scenario = {
  name: 'reports',
  essential: false,
  needsReady: true,
  requires: ['GET /v1/videos/{id}/comments', 'POST /v1/comments/{id}/reports'],
  async run({ world, api, state }) {
    const tally = createTally();
    for (const spec of world.reports) {
      const video = state.videos.get(spec.videoKey);
      const reporter = userById(world, spec.reporterId);
      if (!video || video.status !== 'READY' || !reporter) continue;
      const actor = actorOf(reporter);
      const comment = await findRoot(api, actor, video.id, spec.commentAuthorId, spec.commentText);
      if (isErr(comment)) {
        tally.fail(comment.error);
        continue;
      }
      if (!comment.value) continue;
      const sent = await api.send(
        {
          actor,
          method: 'POST',
          path: `/v1/comments/${comment.value.id}/reports`,
          json: { reason: spec.reason, note: spec.note },
        },
        AnySchema
      );
      if (!isErr(sent)) tally.created();
      else if (sent.error.kind === 'http' && sent.error.status === 409) tally.existing();
      else tally.fail(sent.error);
    }
    return tally.outcome('comment reports');
  },
};
