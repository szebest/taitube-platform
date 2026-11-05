import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { expectOk } from '@vp/testing/result';
import { readLiveChatBacklog } from '../live-chat-backlog';
import { STARTED, STREAM_ID, VIEWER } from './live-harness';

const lineId = (n: number) => `00000000-0000-7000-8000-00000000000${n}`;

async function backlog(after: number | null) {
  const repositories = new InMemoryRepositories();
  for (const n of [1, 2, 3, 4]) {
    expectOk(
      await repositories.liveChat.append({
        id: lineId(n),
        liveStreamId: STREAM_ID,
        userId: VIEWER.id,
        message: `line ${n}`,
        offsetMs: n,
        createdAt: STARTED,
      })
    );
  }
  const read = await readLiveChatBacklog(
    repositories.liveChat,
    STREAM_ID,
    after === null ? null : lineId(after),
    2
  );
  const { resume, lines } = expectOk(read);
  return { resume, lines: lines.map((line) => line.message) };
}

describe('apps/server/api/services: readLiveChatBacklog', () => {
  it.each([
    { scenario: 'no cursor', after: null, resume: 'fresh', lines: ['line 3', 'line 4'] },
    {
      scenario: 'a cursor two lines back',
      after: 2,
      resume: 'replayed',
      lines: ['line 3', 'line 4'],
    },
    { scenario: 'a cursor at the end', after: 4, resume: 'replayed', lines: [] },
    { scenario: 'a cursor too far back', after: 1, resume: 'expired', lines: ['line 3', 'line 4'] },
  ])('answers $scenario as $resume', async ({ after, resume, lines }) => {
    expect(await backlog(after)).toEqual({ resume, lines });
  });
});
