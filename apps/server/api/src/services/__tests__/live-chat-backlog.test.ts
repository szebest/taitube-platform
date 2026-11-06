import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { expectOk } from '@vp/testing/result';
import { readLiveChatBacklog } from '../live-chat-backlog';
import { STARTED, STREAM_ID, VIEWER } from './live-harness';

const lineId = (n: number) => `00000000-0000-7000-8000-00000000000${n}`;
const secondsIn = (n: number) => new Date(STARTED.getTime() + n * 1_000);

/** Four lines, sent a second apart, with the given ones removed at the given second. */
async function backlog(after: number | null, removals: [line: number, atSecond: number][] = []) {
  const { liveChat } = new InMemoryRepositories();
  for (const n of [1, 2, 3, 4]) {
    expectOk(
      await liveChat.append({
        id: lineId(n),
        liveStreamId: STREAM_ID,
        userId: VIEWER.id,
        message: `line ${n}`,
        offsetMs: n * 1_000,
        createdAt: secondsIn(n),
      })
    );
  }
  for (const [n, at] of removals)
    expectOk(await liveChat.remove(STREAM_ID, lineId(n), secondsIn(at)));

  const read = expectOk(
    await readLiveChatBacklog(liveChat, STREAM_ID, after === null ? null : lineId(after), 2)
  );
  return { ...read, lines: read.lines.map((line) => line.message) };
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
    expect(await backlog(after)).toEqual({ resume, removed: [], lines });
  });

  it('tells a replayed client which lines it still shows were removed while it was away', async () => {
    const read = await backlog(3, [
      [1, 2],
      [2, 5],
    ]);

    expect([read.removed, read.lines]).toEqual([[lineId(2)], ['line 4']]);
  });
});
