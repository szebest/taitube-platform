import type { AdminPick } from '#app/features/admin/api/admin-picks';
import type { PickVideo } from '#app/features/admin/api/pick-videos';
import { changesOf, draftIssues, hasIssues, type PickDraft } from '../pick-draft';
import { toLocalInput } from '../pick-schedule';

const NOW = new Date(2026, 9, 31, 12, 0);
const VIDEO = { id: 'v1', title: 'Cats' } as PickVideo;
const local = (day: number) => toLocalInput(new Date(2026, 10, day, 9).toISOString());

const DRAFT: PickDraft = { video: VIDEO, startsAt: local(2), endsAt: local(3), note: 'Hi' };
const CONTEXT = { picks: [], now: NOW };

const PICK = {
  videoId: 'v1',
  startsAt: new Date(2026, 10, 2, 9).toISOString(),
  endsAt: new Date(2026, 10, 3, 9).toISOString(),
  note: 'Hi',
} as AdminPick;

const NEXT = {
  videoId: 'v1',
  startsAt: new Date(PICK.startsAt),
  endsAt: new Date(PICK.endsAt),
  note: 'Hi',
};

describe('apps/client/studio: pick draft', () => {
  it.each([
    { name: 'a complete draft', draft: DRAFT, issues: false },
    { name: 'no video', draft: { ...DRAFT, video: null }, issues: true },
    { name: 'a note over the limit', draft: { ...DRAFT, note: 'a'.repeat(281) }, issues: true },
    { name: 'no window', draft: { ...DRAFT, endsAt: '' }, issues: true },
  ])('finds issues in $name: $issues', ({ draft, issues }) => {
    expect(hasIssues(draftIssues(draft, CONTEXT))).toBe(issues);
  });

  it.each([
    { name: 'nothing', next: NEXT, changes: undefined },
    {
      name: 'a few seconds the input cannot show',
      next: { ...NEXT, startsAt: new Date(new Date(PICK.startsAt).getTime() + 5000) },
      changes: undefined,
    },
    { name: 'the video', next: { ...NEXT, videoId: 'v2' }, changes: { videoId: 'v2' } },
    {
      name: 'the start',
      next: { ...NEXT, startsAt: new Date(2026, 10, 2, 10) },
      changes: { startsAt: new Date(2026, 10, 2, 10).toISOString() },
    },
    {
      name: 'the end',
      next: { ...NEXT, endsAt: new Date(2026, 10, 3, 10) },
      changes: { endsAt: new Date(2026, 10, 3, 10).toISOString() },
    },
    { name: 'the note', next: { ...NEXT, note: null }, changes: { note: null } },
  ])('sends only what changed: $name', ({ next, changes }) => {
    expect(changesOf(PICK, next)).toEqual(changes);
  });
});
