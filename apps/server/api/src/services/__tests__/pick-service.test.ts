import { databaseUnavailable, ErrorCodes } from '@vp/errors';
import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import type { CurrentPickService } from '../current-pick-service';
import type { PickService } from '../pick-service';
import {
  ABSENT,
  ADMIN,
  HOUR,
  instant,
  NOW,
  type PickWorld,
  PRIVATE,
  PROCESSING,
  pickWorld,
  SECOND,
  STRANGER,
  VIDEO,
} from './pick-fixtures';

describe('apps/server/api/services: PickService', () => {
  let world: PickWorld;
  let service: PickService;
  let current: CurrentPickService;

  const schedule = (
    body: Parameters<PickWorld['schedule']>[1] = {},
    caller: Parameters<PickWorld['schedule']>[2] = ADMIN
  ) => world.schedule(service, body, caller);

  beforeEach(async () => {
    world = await pickWorld();
    service = world.pickService();
    current = world.currentPickService();
  });

  describe('list', () => {
    it('lists the picks of the next 30 days earliest first, each with its video', async () => {
      await schedule({
        startsAt: instant(NOW + 2 * 24 * HOUR),
        endsAt: instant(NOW + 3 * 24 * HOUR),
      });
      await schedule({ videoId: SECOND });
      await schedule({
        startsAt: instant(NOW + 40 * 24 * HOUR),
        endsAt: instant(NOW + 41 * 24 * HOUR),
      });

      const { items } = expectOk(await service.list(ADMIN, {}));

      expect(items.map((item) => item.video.id)).toEqual([SECOND, VIDEO]);
    });

    it('lists the range it is given', async () => {
      await schedule({
        startsAt: instant(NOW + 40 * 24 * HOUR),
        endsAt: instant(NOW + 41 * 24 * HOUR),
      });

      const { items } = expectOk(
        await service.list(ADMIN, {
          from: instant(NOW + 39 * 24 * HOUR),
          to: instant(NOW + 42 * 24 * HOUR),
        })
      );

      expect(items).toHaveLength(1);
    });

    it.each([
      { name: 'an anonymous caller', caller: null, code: ErrorCodes.UNAUTHORIZED },
      { name: 'a signed-in user', caller: STRANGER, code: ErrorCodes.FORBIDDEN },
    ])('refuses $name with $code', async ({ caller, code }) => {
      expect(expectErr(await service.list(caller, {})).code).toBe(code);
    });
  });

  describe('create', () => {
    it('stores the pick with a fresh id, the admin and the clock, and answers it with its video', async () => {
      const created = expectOk(await schedule({ note: '  Worth it ' }));

      expect(created).toMatchObject({
        videoId: VIDEO,
        note: 'Worth it',
        createdBy: ADMIN.id,
        createdAt: instant(NOW),
        video: { id: VIDEO, channel: { handle: 'owner' } },
      });
      expect(expectOk(await world.repositories.picks.findById(created.id))).not.toBeNull();
    });

    it.each([
      { name: 'an anonymous caller', body: {}, caller: null, code: ErrorCodes.UNAUTHORIZED },
      { name: 'a signed-in user', body: {}, caller: STRANGER, code: ErrorCodes.FORBIDDEN },
      {
        name: 'an absent video',
        body: { videoId: ABSENT },
        caller: ADMIN,
        code: ErrorCodes.VIDEO_NOT_FOUND,
      },
      {
        name: 'a private video',
        body: { videoId: PRIVATE },
        caller: ADMIN,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        name: 'a video still processing',
        body: { videoId: PROCESSING },
        caller: ADMIN,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        name: 'a window in the past',
        body: { startsAt: instant(NOW - 3 * HOUR), endsAt: instant(NOW - HOUR) },
        caller: ADMIN,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        name: 'an over-long note',
        body: { note: 'a'.repeat(281) },
        caller: ADMIN,
        code: ErrorCodes.VALIDATION_FAILED,
      },
    ])('refuses $name with $code and stores nothing', async ({ body, caller, code }) => {
      expect(expectErr(await schedule(body, caller)).code).toBe(code);
      expect(
        expectOk(
          await world.repositories.picks.listBetween({ from: new Date(0), to: new Date(NOW * 2) })
        )
      ).toEqual([]);
    });

    it('refuses a window another pick holds, but lets one start where it ends', async () => {
      await schedule();

      const overlap = await schedule({ videoId: SECOND, startsAt: instant(NOW + HOUR) });
      const adjacent = await schedule({
        videoId: SECOND,
        startsAt: instant(NOW + 14 * HOUR),
        endsAt: instant(NOW + 20 * HOUR),
      });

      expect(expectErr(overlap).code).toBe(ErrorCodes.PICK_WINDOW_OVERLAP);
      expect(expectOk(adjacent).videoId).toBe(SECOND);
    });

    it('drops the cached current pick', async () => {
      await schedule();
      expectOk(await current.current());

      const second = await schedule({
        videoId: SECOND,
        startsAt: instant(NOW + 14 * HOUR),
        endsAt: instant(NOW + 20 * HOUR),
      });

      expectOk(second);
      expect(expectOk(await world.store.get('taitube:picks:current:v1'))).toBeNull();
    });

    it('passes a failing store on', async () => {
      const failure = databaseUnavailable('findOverlappingPick', new Error('down'));
      service = world.pickService({
        picks: Object.assign(Object.create(world.repositories.picks), {
          findOverlapping: async () => err(failure),
        }),
      });

      expect(expectErr(await schedule())).toBe(failure);
    });
  });

  describe('update', () => {
    it('changes the note and shows it on the next read of the current pick', async () => {
      const created = expectOk(await schedule());
      expectOk(await current.current());

      const updated = expectOk(await service.update(ADMIN, created.id, { note: 'New line' }));

      expect(updated).toMatchObject({ id: created.id, note: 'New line', videoId: VIDEO });
      expect(expectOk(await current.current()).data.note).toBe('New line');
    });

    it('clears the note, moves the video and keeps the window', async () => {
      const created = expectOk(await schedule());

      const updated = expectOk(
        await service.update(ADMIN, created.id, { videoId: SECOND, note: null })
      );

      expect(updated).toMatchObject({
        note: null,
        videoId: SECOND,
        video: { id: SECOND },
        startsAt: created.startsAt,
        endsAt: created.endsAt,
      });
    });

    it('lets a pick grow into free time and refuses growing into the next one', async () => {
      const first = expectOk(await schedule());
      expectOk(
        await schedule({
          videoId: SECOND,
          startsAt: instant(NOW + 20 * HOUR),
          endsAt: instant(NOW + 30 * HOUR),
        })
      );

      const grown = await service.update(ADMIN, first.id, { endsAt: instant(NOW + 18 * HOUR) });
      const blocked = await service.update(ADMIN, first.id, { endsAt: instant(NOW + 25 * HOUR) });

      expect(expectOk(grown).endsAt).toBe(instant(NOW + 18 * HOUR));
      expect(expectErr(blocked).code).toBe(ErrorCodes.PICK_WINDOW_OVERLAP);
    });

    it.each([
      {
        name: 'an anonymous caller',
        caller: null,
        id: undefined,
        body: { note: 'x' },
        code: ErrorCodes.UNAUTHORIZED,
      },
      {
        name: 'a signed-in user',
        caller: STRANGER,
        id: undefined,
        body: { note: 'x' },
        code: ErrorCodes.FORBIDDEN,
      },
      {
        name: 'an unknown pick',
        caller: ADMIN,
        id: ABSENT,
        body: { note: 'x' },
        code: ErrorCodes.PICK_NOT_FOUND,
      },
      {
        name: 'a private video',
        caller: ADMIN,
        id: undefined,
        body: { videoId: PRIVATE },
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        name: 'an over-long note',
        caller: ADMIN,
        id: undefined,
        body: { note: 'a'.repeat(281) },
        code: ErrorCodes.VALIDATION_FAILED,
      },
    ])('refuses $name with $code', async ({ caller, id, body, code }) => {
      const created = expectOk(await schedule());

      expect(expectErr(await service.update(caller, id ?? created.id, body)).code).toBe(code);
    });
  });

  describe('cancel', () => {
    it('removes the pick, also a running one, and the home falls back at once', async () => {
      const created = expectOk(await schedule());
      expectOk(await current.current());

      expectOk(await service.cancel(ADMIN, created.id));

      expect(expectOk(await world.repositories.picks.findById(created.id))).toBeNull();
      expect(expectOk(await current.current()).data.source).toBe('fallback');
    });

    it.each([
      { name: 'an anonymous caller', caller: null, id: undefined, code: ErrorCodes.UNAUTHORIZED },
      { name: 'a signed-in user', caller: STRANGER, id: undefined, code: ErrorCodes.FORBIDDEN },
      { name: 'an unknown pick', caller: ADMIN, id: ABSENT, code: ErrorCodes.PICK_NOT_FOUND },
    ])('refuses $name with $code', async ({ caller, id, code }) => {
      const created = expectOk(await schedule());

      expect(expectErr(await service.cancel(caller, id ?? created.id)).code).toBe(code);
      expect(expectOk(await world.repositories.picks.findById(created.id))).not.toBeNull();
    });
  });
});
