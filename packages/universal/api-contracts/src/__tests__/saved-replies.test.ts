import {
  CreateSavedReplyBodySchema,
  UpdateSavedReplyBodySchema,
  createSavedReply,
  deleteSavedReply,
  listSavedReplies,
  updateSavedReply,
} from '../saved-replies';

describe('packages/api-contracts: saved replies', () => {
  it.each([
    { endpoint: listSavedReplies, method: 'GET', path: '/v1/me/channel/saved-replies' },
    { endpoint: createSavedReply, method: 'POST', path: '/v1/me/channel/saved-replies' },
    { endpoint: updateSavedReply, method: 'PATCH', path: '/v1/me/channel/saved-replies/:id' },
    { endpoint: deleteSavedReply, method: 'DELETE', path: '/v1/me/channel/saved-replies/:id' },
  ])('serves $method $path for the acting channel', ({ endpoint, method, path }) => {
    expect(endpoint).toMatchObject({ method, path, channelScoped: true });
  });

  it.each([
    { scenario: 'a blank title', body: { title: '  ', body: 'x' }, valid: false },
    {
      scenario: 'a title over 40 characters',
      body: { title: 'x'.repeat(41), body: 'x' },
      valid: false,
    },
    {
      scenario: 'a body over 2000 characters',
      body: { title: 'x', body: 'x'.repeat(2001) },
      valid: false,
    },
    { scenario: 'a title and a body', body: { title: ' Thanks ', body: 'Thanks!' }, valid: true },
  ])('create accepts only a valid reply: $scenario', ({ body, valid }) => {
    expect(CreateSavedReplyBodySchema.safeParse(body).success).toBe(valid);
  });

  it.each([
    { scenario: 'no field', body: {}, valid: false },
    { scenario: 'a position only', body: { position: 2 }, valid: true },
    { scenario: 'a negative position', body: { position: -1 }, valid: false },
  ])('update needs one valid field: $scenario', ({ body, valid }) => {
    expect(UpdateSavedReplyBodySchema.safeParse(body).success).toBe(valid);
  });

  it('refuses an id that is not a UUID', () => {
    expect(updateSavedReply.params.safeParse({ id: 'one' }).success).toBe(false);
  });
});
