import { ErrorCodes } from '@vp/errors';
import { ABSENT, closeSharedCommentsApp } from '../../__tests__/comments-app';
import {
  AS_SCREENING,
  HELD,
  type ScreeningApp,
  type ScreeningWho,
  sharedScreeningApp,
} from '../../__tests__/screening-app';

describe('creator screening routes', () => {
  let ctx: ScreeningApp;

  beforeEach(async () => {
    ctx = await sharedScreeningApp();
  });

  afterAll(closeSharedCommentsApp);

  const read = (who: ScreeningWho | null, id = HELD) =>
    ctx.app.inject({
      method: 'GET',
      url: `/v1/creator/videos/${id}/screening`,
      headers: who ? AS_SCREENING[who] : {},
    });
  const appeal = (
    who: ScreeningWho | null,
    payload: object = { message: 'It is mine' },
    id = HELD
  ) =>
    ctx.app.inject({
      method: 'POST',
      url: `/v1/creator/videos/${id}/screening/appeal`,
      headers: who ? AS_SCREENING[who] : {},
      payload,
    });
  const reject = () =>
    ctx.app.inject({
      method: 'POST',
      url: `/v1/admin/videos/${HELD}/screening/reject`,
      headers: AS_SCREENING.admin,
      payload: { reason: 'A re-upload' },
    });

  describe('why a video is held', () => {
    it('tells the owner in plain terms, with no matched video and no score', async () => {
      const res = await read('creator');

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        videoId: HELD,
        status: 'HELD',
        reasons: ['DUPLICATE'],
        decision: null,
        decisionNote: null,
        canAppeal: false,
        appeal: null,
      });
    });

    it.each<{ who: ScreeningWho | null; id?: string; status: number }>([
      { who: null, status: 401 },
      { who: 'stranger', status: 403 },
      { who: 'creator', id: ABSENT, status: 404 },
    ])('answers $status to $who', async ({ who, id, status }) => {
      expect((await read(who, id)).statusCode).toBe(status);
    });
  });

  describe('the appeal', () => {
    it('takes a screening rejection back to hold with the message, once', async () => {
      await reject();

      const res = await appeal('creator');

      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({
        status: 'HELD',
        appeal: { message: 'It is mine', resolved: false },
      });
      expect((await appeal('creator')).statusCode).toBe(422);
    });

    it.each([
      { name: 'no message', payload: {} },
      { name: 'a blank message', payload: { message: '  ' } },
      { name: 'a message over 1000 characters', payload: { message: 'x'.repeat(1001) } },
    ])('refuses $name', async ({ payload }) => {
      await reject();

      expect((await appeal('creator', payload)).statusCode).toBe(400);
    });

    it('refuses a video that is only held, and a stranger', async () => {
      expect((await appeal('creator')).statusCode).toBe(422);

      await reject();

      expect((await appeal('stranger')).statusCode).toBe(403);
      expect((await appeal(null)).statusCode).toBe(401);
    });

    it('refuses an appeal of a takedown by a moderator', async () => {
      const taken = await ctx.app.inject({
        method: 'POST',
        url: `/v1/admin/videos/${HELD}/takedown`,
        headers: AS_SCREENING.admin,
        payload: { reason: 'Terms' },
      });
      expect(taken.statusCode).toBe(200);

      const res = await appeal('creator');

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe(ErrorCodes.FORBIDDEN);
    });
  });
});
