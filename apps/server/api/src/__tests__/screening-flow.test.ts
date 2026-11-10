import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import { AS, CREATOR, closeSharedCommentsApp, VIDEO } from './comments-app';
import { AS_SCREENING, HELD, type ScreeningApp, sharedScreeningApp } from './screening-app';

describe('screening through the API: hold, review and appeal', () => {
  let ctx: ScreeningApp;

  beforeEach(async () => {
    ctx = await sharedScreeningApp();
  });

  afterAll(closeSharedCommentsApp);

  const post = (who: keyof typeof AS_SCREENING, url: string, payload?: object) =>
    ctx.app.inject({
      method: 'POST',
      url,
      headers: AS_SCREENING[who],
      ...(payload ? { payload } : {}),
    });
  const listed = async () =>
    (await ctx.app.inject({ method: 'GET', url: '/v1/feed' }))
      .json()
      .items.map((v: { id: string }) => v.id);

  it('keeps a held video out of the listing and without a playback url, for anyone', async () => {
    expect(await listed()).toEqual([VIDEO]);

    const asStranger = await ctx.app.inject({
      method: 'GET',
      url: `/v1/videos/${HELD}`,
      headers: AS.stranger,
    });

    expect(asStranger.json()).toMatchObject({ status: 'HELD' });
    expect(asStranger.json().playbackUrl).toBeUndefined();
  });

  it('puts a rejected video back on hold with the appeal, and a different moderator approves it', async () => {
    expect(
      (await post('admin', `/v1/admin/videos/${HELD}/screening/reject`, { reason: 'A re-upload' }))
        .statusCode
    ).toBe(200);
    expect(
      (await post('creator', `/v1/creator/videos/${HELD}/screening/appeal`, { message: 'Mine' }))
        .statusCode
    ).toBe(201);

    const sameModerator = await post('admin', `/v1/admin/videos/${HELD}/screening/approve`);
    expect(sameModerator.statusCode).toBe(403);
    expect(sameModerator.json().code).toBe(ErrorCodes.FORBIDDEN);

    const approved = await post('secondAdmin', `/v1/admin/videos/${HELD}/screening/approve`);
    expect(approved.json()).toEqual({ videoId: HELD, status: 'PROCESSING' });
    expect(await listed()).toEqual([VIDEO]);
  });

  it('tells the creator on the event stream, step by step, and through the notification jobs', async () => {
    await post('admin', `/v1/admin/videos/${HELD}/screening/reject`, { reason: 'A re-upload' });
    await post('creator', `/v1/creator/videos/${HELD}/screening/appeal`, { message: 'Mine' });
    await post('secondAdmin', `/v1/admin/videos/${HELD}/screening/approve`);

    const statuses = expectOk(await ctx.repositories.userEvents.listFrom(CREATOR, 0, 10)).map(
      (event) => event.payload
    );
    const events = expectOk(await ctx.repositories.events.findByVideoId(HELD)).map(
      (event) => event.type
    );

    expect(statuses).toMatchObject([
      { videoId: HELD, change: { kind: 'status', status: 'REJECTED' } },
      { videoId: HELD, change: { kind: 'status', status: 'HELD' } },
      { videoId: HELD, change: { kind: 'status', status: 'PROCESSING' } },
    ]);
    expect(events).toEqual([
      'video.screening_rejected',
      'video.screening_appealed',
      'video.screening_approved',
    ]);
  });
});
