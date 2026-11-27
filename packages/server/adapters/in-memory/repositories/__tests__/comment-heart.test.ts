import { applyHeart } from '../comment-heart';
import { InMemoryOutboxRepository } from '../in-memory-outbox-repository';
import { aStoredComment } from './stored-comment';

describe('adapters/in-memory: applyHeart', () => {
  it('stamps the first heart and enqueues one notification, then does nothing more', async () => {
    const outbox = new InMemoryOutboxRepository();
    const comment = aStoredComment();

    await applyHeart(outbox, comment, true);
    await applyHeart(outbox, comment, true);

    expect(comment.heartedAt).toBeInstanceOf(Date);
    expect(outbox.getAll()).toHaveLength(1);
  });

  it('takes the heart back without enqueueing', async () => {
    const outbox = new InMemoryOutboxRepository();
    const comment = aStoredComment({ heartedAt: new Date() });

    await applyHeart(outbox, comment, false);

    expect(comment.heartedAt).toBeNull();
    expect(outbox.getAll()).toHaveLength(0);
  });
});
