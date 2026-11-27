import {
  VIDEO_PASSWORD_MAX_LENGTH,
  VIDEO_PASSWORD_MIN_LENGTH,
  VIDEO_UNLOCK_ATTEMPTS_PER_MINUTE,
  VIDEO_UNLOCK_TTL_SECONDS,
} from '../video-access';

describe('@vp/domain: video access', () => {
  it('unlocks for 12 hours, allows 5 attempts a minute and passwords of 4 to 128 characters', () => {
    expect([
      VIDEO_UNLOCK_TTL_SECONDS,
      VIDEO_UNLOCK_ATTEMPTS_PER_MINUTE,
      VIDEO_PASSWORD_MIN_LENGTH,
      VIDEO_PASSWORD_MAX_LENGTH,
    ]).toEqual([43_200, 5, 4, 128]);
  });
});
