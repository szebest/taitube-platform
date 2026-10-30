import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { EditorPick, EditorPickEntry } from '@vp/domain';
import { seedVideo } from '../../__tests__/test-app';
import { toFallbackView, toPickView, toScheduledView } from '../pick-views';
import { toVideoSummaryView } from '../video-views';
import { TEST_CDN, TEST_SPRITE } from './service-deps';

const OWNER = '00000000-0000-7000-8000-00000000f0a1';
const VIDEO = '00000000-0000-7000-8000-00000000f0b1';

const pick: EditorPick = {
  id: '00000000-0000-7000-8000-00000000f0c1',
  videoId: VIDEO,
  startsAt: new Date('2026-03-02T00:00:00.000Z'),
  endsAt: new Date('2026-03-03T00:00:00.000Z'),
  note: 'Worth the ten minutes',
  createdBy: OWNER,
  createdAt: new Date('2026-03-01T00:00:00.000Z'),
};

async function entryOf(overrides: Partial<EditorPick> = {}): Promise<EditorPickEntry> {
  const repositories = new InMemoryRepositories();
  const video = await seedVideo(repositories, { id: VIDEO, ownerId: OWNER, title: 'Match' });
  return { pick: { ...pick, ...overrides }, video, channel: null };
}

describe('apps/server/api/services: pick views', () => {
  it('renders the admin view with ISO instants and the video summary', async () => {
    const entry = await entryOf();

    expect(toPickView(entry, TEST_CDN, TEST_SPRITE)).toEqual({
      ...pick,
      startsAt: '2026-03-02T00:00:00.000Z',
      endsAt: '2026-03-03T00:00:00.000Z',
      createdAt: '2026-03-01T00:00:00.000Z',
      video: toVideoSummaryView(entry.video, TEST_CDN, TEST_SPRITE, null),
    });
  });

  it.each([
    { name: 'a note', note: 'Worth it' },
    { name: 'no note', note: null },
  ])('renders a scheduled pick with $name and its window', async ({ note }) => {
    const entry = await entryOf({ note });

    expect(toScheduledView(entry, TEST_CDN, TEST_SPRITE)).toMatchObject({
      source: 'scheduled',
      note,
      startsAt: '2026-03-02T00:00:00.000Z',
      endsAt: '2026-03-03T00:00:00.000Z',
      video: { id: VIDEO },
    });
  });

  it('renders a fallback with no note and no window', async () => {
    const { video } = await entryOf();
    const summary = toVideoSummaryView(video, TEST_CDN, TEST_SPRITE, null);

    expect(toFallbackView(summary)).toEqual({
      source: 'fallback',
      video: summary,
      note: null,
      startsAt: null,
      endsAt: null,
    });
  });
});
