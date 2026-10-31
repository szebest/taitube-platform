import type { PickRepositoryPort } from '@vp/core/repositories';
import type { EditorPick } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const DAY = 86_400_000;
const BASE = Date.parse('2026-03-01T00:00:00.000Z');

const pickId = (n: number) => `00000000-0000-7000-8000-00000000d1${String(n).padStart(2, '0')}`;
const day = (n: number) => new Date(BASE + n * DAY);

function pick(
  n: number,
  from: number,
  to: number,
  overrides: Partial<EditorPick> = {}
): EditorPick {
  return {
    id: pickId(n),
    videoId: VIDEO_IDS.a,
    startsAt: day(from),
    endsAt: day(to),
    note: `Pick ${n}`,
    createdBy: OWNER_ID,
    createdAt: new Date(BASE - DAY),
    ...overrides,
  };
}

export function describePickRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('PickRepository contract', () => {
    let subject: RepositoriesSubject;
    let picks: PickRepositoryPort;

    const save = async (...rows: EditorPick[]) => {
      for (const row of rows) expectOk(await picks.create(row));
    };

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.b }));
      await subject.repositories.channels.create({
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'The Owner',
      });
      picks = subject.repositories.picks;
    });

    it('finds a stored pick by id and answers null for an unknown one', async () => {
      await save(pick(1, 0, 1));

      expect(expectOk(await picks.findById(pickId(1)))).toEqual(pick(1, 0, 1));
      expect(expectOk(await picks.findById(pickId(2)))).toBeNull();
    });

    it('keeps a pick without a note', async () => {
      await save(pick(1, 0, 1, { note: null }));

      expect(expectOk(await picks.findById(pickId(1)))?.note).toBeNull();
    });

    it('removes a pick once and reports whether it was there', async () => {
      await save(pick(1, 0, 1));

      expect(expectOk(await picks.remove(pickId(1)))).toBe(true);
      expect(expectOk(await picks.remove(pickId(1)))).toBe(false);
      expect(expectOk(await picks.findById(pickId(1)))).toBeNull();
    });

    it.each([
      { name: 'the same window', from: 0, to: 1 },
      { name: 'a window inside it', from: 0.25, to: 0.75 },
      { name: 'a window around it', from: -1, to: 2 },
      { name: 'a window crossing its start', from: -0.5, to: 0.5 },
      { name: 'a window crossing its end', from: 0.5, to: 1.5 },
    ])('refuses $name as an overlap, in the store itself', async ({ from, to }) => {
      await save(pick(1, 0, 1));

      const failure = expectErr(await picks.create(pick(2, from, to)));

      expect(failure.code).toBe(ErrorCodes.PICK_WINDOW_OVERLAP);
      expect(expectOk(await picks.findById(pickId(2)))).toBeNull();
    });

    it.each([
      { name: 'right after it', from: 1, to: 2 },
      { name: 'right before it', from: -1, to: 0 },
    ])('lets a window sit $name, because windows are half-open', async ({ from, to }) => {
      await save(pick(1, 0, 1));

      expect(expectOk(await picks.create(pick(2, from, to)))).toBeUndefined();
    });

    it('finds the pick holding part of a window, leaving out the one an edit passes for itself', async () => {
      await save(pick(1, 0, 1), pick(2, 2, 3));
      const window = { startsAt: day(0.5), endsAt: day(2.5) };

      expect(expectOk(await picks.findOverlapping(window))?.id).toBe(pickId(1));
      expect(expectOk(await picks.findOverlapping(window, pickId(1)))?.id).toBe(pickId(2));
      expect(
        expectOk(await picks.findOverlapping({ startsAt: day(1), endsAt: day(2) }))
      ).toBeNull();
    });

    it('replaces a pick and reports whether it was there', async () => {
      await save(pick(1, 0, 1));

      const changed = pick(1, 0, 2, { videoId: VIDEO_IDS.b, note: null });

      expect(expectOk(await picks.update(changed))).toBe(true);
      expect(expectOk(await picks.findById(pickId(1)))).toEqual(changed);
      expect(expectOk(await picks.update(pick(9, 5, 6)))).toBe(false);
    });

    it('refuses an edit that grows into the next pick, leaving both as they were', async () => {
      await save(pick(1, 0, 1), pick(2, 2, 3));

      const failure = expectErr(await picks.update(pick(1, 0, 2.5)));

      expect(failure.code).toBe(ErrorCodes.PICK_WINDOW_OVERLAP);
      expect(expectOk(await picks.findById(pickId(1)))).toEqual(pick(1, 0, 1));
    });

    it('finds the pick whose window holds an instant, the start included and the end not', async () => {
      await save(pick(1, 0, 1), pick(2, 1, 2));

      expect(expectOk(await picks.findCurrent(day(0.5)))?.pick.id).toBe(pickId(1));
      expect(expectOk(await picks.findCurrent(day(1)))?.pick.id).toBe(pickId(2));
      expect(expectOk(await picks.findCurrent(day(2)))).toBeNull();
      expect(expectOk(await picks.findCurrent(day(-1)))).toBeNull();
    });

    it('hands the current pick with its video and the video channel, whatever the video state', async () => {
      const hidden = '00000000-0000-7000-8000-0000000000f7';
      await subject.repositories.videos.create(publicVideo({ id: hidden, visibility: 'private' }));
      await save(pick(1, 0, 1, { videoId: hidden }));

      expect(expectOk(await picks.findCurrent(day(0.5)))).toMatchObject({
        pick: { id: pickId(1), note: 'Pick 1' },
        video: { id: hidden, visibility: 'private' },
        channel: { handle: 'owner' },
      });
    });

    it('lists the picks touching a range earliest first, each with its video', async () => {
      await save(pick(1, 0, 1), pick(2, 1, 2, { videoId: VIDEO_IDS.b }), pick(3, 5, 6));

      const entries = expectOk(await picks.listBetween({ from: day(0.5), to: day(3) }));

      expect(entries.map((entry) => entry.pick.id)).toEqual([pickId(1), pickId(2)]);
      expect(entries[1]).toMatchObject({
        video: { id: VIDEO_IDS.b },
        channel: { handle: 'owner' },
      });
    });
  });
}
