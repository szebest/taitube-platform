import { getMyReaction, setReaction } from '../reactions';

describe('packages/api-contracts: reactions', () => {
  it('sets a reaction with PUT and reads the caller reaction with GET', () => {
    expect(setReaction).toMatchObject({ method: 'PUT', path: '/v1/videos/:id/reactions' });
    expect(getMyReaction).toMatchObject({ method: 'GET', path: '/v1/videos/:id/reactions/me' });
  });

  it.each(['LIKE', 'DISLIKE', 'NONE'])('accepts %s as an input reaction', (type) => {
    expect(setReaction.body.parse({ type }).type).toBe(type);
  });

  it('rejects NONE as a stored reaction, where absence is null', () => {
    const videoId = '00000000-0000-7000-8000-0000000000f1';

    expect(getMyReaction.result.parse({ videoId, reaction: null }).reaction).toBeNull();
    expect(getMyReaction.result.safeParse({ videoId, reaction: 'NONE' }).success).toBe(false);
  });

  it('promises a 403 on an unauthorized reaction', () => {
    expect(setReaction.errors[403]).toContain('FORBIDDEN');
  });
});
