import { SHARE_LINK_TOKEN_LENGTH } from '@vp/domain';
import { videoAccessSecrets } from '../video-access-secrets';

const VIDEO = '00000000-0000-7000-8000-0000000000a1';
const HASH = 'scrypt$16384$8$1$salt$hash';
const NOW = Date.parse('2026-11-20T12:00:00.000Z');
const LATER = NOW + 3_600_000;

describe('apps/server/api/composition: video access secrets', () => {
  const unlock = videoAccessSecrets('a-secret').unlock;
  const issued = unlock?.issue(VIDEO, HASH, LATER) ?? '';

  it('makes share tokens of 22 URL-safe characters, fresh each time', () => {
    const { newShareToken } = videoAccessSecrets(undefined);

    expect(newShareToken()).toMatch(new RegExp(`^[\\w-]{${SHARE_LINK_TOKEN_LENGTH}}$`));
    expect(newShareToken()).not.toBe(newShareToken());
  });

  it('turns unlocking off without a secret', () => {
    expect(videoAccessSecrets(undefined).unlock).toBeNull();
  });

  it('accepts its own credential until it expires', () => {
    expect(unlock?.verify(VIDEO, HASH, issued, NOW)).toBe(true);
    expect(unlock?.verify(VIDEO, HASH, issued, LATER)).toBe(false);
  });

  it.each([
    { scenario: 'another video', videoId: '00000000-0000-7000-8000-0000000000a2', hash: HASH },
    { scenario: 'a new password', videoId: VIDEO, hash: 'scrypt$16384$8$1$salt$other' },
  ])('refuses the credential for $scenario', ({ videoId, hash }) => {
    expect(unlock?.verify(videoId, hash, issued, NOW)).toBe(false);
  });

  it.each([
    {
      scenario: 'signed with another secret',
      of: () => videoAccessSecrets('other').unlock?.issue(VIDEO, HASH, LATER) ?? '',
    },
    {
      scenario: 'with a later expiry written in',
      of: () => issued.replace(/^\d+/, (at) => String(Number(at) + 3600)),
    },
    { scenario: 'cut short', of: () => issued.slice(0, -4) },
    { scenario: 'without a signature', of: () => issued.split('.')[0] ?? '' },
    { scenario: 'that is not one', of: () => 'not.a.credential' },
  ])('refuses a credential $scenario', ({ of }) => {
    expect(unlock?.verify(VIDEO, HASH, of(), NOW)).toBe(false);
  });
});
