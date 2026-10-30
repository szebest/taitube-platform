import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { registerServices, Services } from '../services.module';

const CREATOR: UserContext = { id: '00000000-0000-7000-8000-00000000f201', role: 'CREATOR' };
const FAN: UserContext = { id: '00000000-0000-7000-8000-00000000f202', role: 'USER' };
const ADMIN: UserContext = { id: '00000000-0000-7000-8000-00000000f203', role: 'ADMIN' };
const VIDEO_ID = '00000000-0000-7000-8000-00000000f204';

describe('apps/server/api/composition: comment module', () => {
  it('hands the comment, report and inbox services one set of repositories', async () => {
    const c = registerServices(await registerAdapters(new Container(), inProcessAppConfig()));
    expectOk(
      await c.get(Adapters.Repositories).videos.create({
        id: VIDEO_ID,
        ownerId: CREATOR.id,
        status: 'READY',
        sourceKey: 'raw/comments.mp4',
        visibility: 'public',
      })
    );
    const comment = expectOk(
      await c.get(Services.CommentService).create(FAN, VIDEO_ID, { content: 'hello' })
    );

    const report = expectOk(
      await c.get(Services.CommentReportService).report(FAN, comment.id, { reason: 'spam' })
    );
    const queue = expectOk(await c.get(Services.CommentReportService).list(ADMIN, {}));
    const inbox = expectOk(
      await c.get(Services.CreatorCommentService).inbox(CREATOR, { filter: 'reported' })
    );

    expect(queue.items.map((item) => item.id)).toEqual([report.id]);
    expect(inbox.items.map((item) => item.id)).toEqual([comment.id]);
    expectOk(await c.dispose());
  });
});
