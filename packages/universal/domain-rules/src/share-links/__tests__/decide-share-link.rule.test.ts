import { err, ok } from '@kit/result';
import type { ShareLink } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { decideShareLink, decideShareLinkUse } from '../decide-share-link.rule';

const NOW = new Date('2026-11-19T12:00:00.000Z');
const CONTEXT = { videoId: 'video-1', active: 0, now: NOW };

function aLink(overrides: Partial<ShareLink> = {}): ShareLink {
  return {
    id: 'link-1',
    targetType: 'video',
    targetId: 'video-1',
    token: 'abcdefghijklmnopqrstuv',
    label: null,
    expiresAt: null,
    createdBy: 'owner-1',
    revokedAt: null,
    createdAt: new Date('2026-11-18T12:00:00.000Z'),
    ...overrides,
  };
}

describe('@vp/domain-rules: decideShareLink', () => {
  it('trims the label and ends the link after its preset', () => {
    expect(decideShareLink({ label: '  Press  ', expiresIn: '24h' }, CONTEXT)).toEqual(
      ok({ label: 'Press', expiresAt: new Date('2026-11-20T12:00:00.000Z') })
    );
  });

  it.each([{ label: undefined }, { label: null }, { label: '   ' }])(
    'stores no label for $label',
    ({ label }) => {
      expect(decideShareLink({ label, expiresIn: 'never' }, CONTEXT)).toEqual(
        ok({ label: null, expiresAt: null })
      );
    }
  );

  it('refuses a label over 60 characters', () => {
    const decided = decideShareLink({ label: 'x'.repeat(61), expiresIn: '1h' }, CONTEXT);

    expect(decided).toMatchObject(err({ code: ErrorCodes.VALIDATION_FAILED, field: 'label' }));
  });

  it.each([
    { active: 49, allowed: true },
    { active: 50, allowed: false },
  ])('with $active active links allows another: $allowed', ({ active, allowed }) => {
    const decided = decideShareLink({ expiresIn: '7d' }, { ...CONTEXT, active });

    expect(decided.ok).toBe(allowed);
    if (!allowed) expect(decided).toMatchObject(err({ code: ErrorCodes.SHARE_LINK_LIMIT }));
  });
});

describe('@vp/domain-rules: decideShareLinkUse', () => {
  it('grants read on its video while live', () => {
    expect(decideShareLinkUse(aLink(), { videoId: 'video-1', now: NOW })).toEqual(
      ok({ targetType: 'video', targetId: 'video-1' })
    );
  });

  it.each([
    { name: 'no link', link: null },
    { name: 'the link of another video', link: aLink({ targetId: 'video-2' }) },
    {
      name: 'a dead link of another video',
      link: aLink({ targetId: 'video-2', revokedAt: NOW }),
    },
  ])('proves nothing with $name', ({ link }) => {
    expect(decideShareLinkUse(link, { videoId: 'video-1', now: NOW })).toEqual(ok(null));
  });

  it.each([
    { name: 'expired', link: aLink({ expiresAt: NOW }) },
    { name: 'revoked', link: aLink({ revokedAt: new Date('2026-11-19T11:59:00.000Z') }) },
  ])('answers SHARE_LINK_EXPIRED for an $name link', ({ link }) => {
    expect(decideShareLinkUse(link, { videoId: 'video-1', now: NOW })).toMatchObject(
      err({ code: ErrorCodes.SHARE_LINK_EXPIRED, videoId: 'video-1' })
    );
  });
});
