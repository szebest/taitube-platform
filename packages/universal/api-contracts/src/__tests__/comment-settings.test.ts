import { getCommentSettings, updateCommentSettings } from '../comment-settings';

const DISCLOSURE = {
  hide: 'silent',
  remove: 'visible',
  manual_hold: 'visible',
  'auto.blocked_words': 'silent',
  'auto.links': 'visible',
  'auto.review_all': 'visible',
};
const SETTINGS = {
  reviewMode: 'none',
  blockedWords: [],
  linkAllowlist: [],
  slowModeSeconds: null,
  subscribersOnly: false,
  minAccountAgeDays: 0,
  disclosure: DISCLOSURE,
};

describe('packages/api-contracts: comment settings', () => {
  it.each([
    { endpoint: getCommentSettings, method: 'GET' },
    { endpoint: updateCommentSettings, method: 'PUT' },
  ])(
    'serves $method /v1/me/channel/comment-settings for the acting channel',
    ({ endpoint, method }) => {
      expect(endpoint).toMatchObject({
        method,
        path: '/v1/me/channel/comment-settings',
        channelScoped: true,
      });
    }
  );

  it('accepts a whole document and refuses one without a disclosure default', () => {
    const { disclosure: _dropped, ...partial } = SETTINGS;

    expect(updateCommentSettings.body.safeParse(SETTINGS).success).toBe(true);
    expect(updateCommentSettings.body.safeParse(partial).success).toBe(false);
  });

  it.each(['loud', 'none'])('refuses the disclosure %s', (value) => {
    const body = { ...SETTINGS, disclosure: { ...DISCLOSURE, hide: value } };

    expect(updateCommentSettings.body.safeParse(body).success).toBe(false);
  });
});
