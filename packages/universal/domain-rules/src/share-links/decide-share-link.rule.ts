import { type Result, err, ok } from '@kit/result';
import { normalizePlainText, withinLength } from '@kit/validation';
import {
  MAX_ACTIVE_SHARE_LINKS,
  SHARE_LINK_LABEL_MAX_LENGTH,
  type ShareLink,
  type ShareLinkExpiry,
  type ShareLinkTargetType,
  shareLinkExpiresAt,
  shareLinkState,
} from '@vp/domain';
import type { ShareGrant } from '@vp/permissions';
import {
  type InvalidShareLink,
  type ShareLinkExpired,
  type ShareLinkLimit,
  invalidShareLink,
  shareLinkExpired,
  shareLinkLimit,
} from './failures';

export interface ShareLinkInput {
  readonly label?: string | null;
  readonly expiresIn: ShareLinkExpiry;
}

/** What a link opens: one video or one playlist. */
export interface ShareLinkTarget {
  readonly targetType: ShareLinkTargetType;
  readonly targetId: string;
}

export interface ShareLinkContext {
  readonly target: ShareLinkTarget;
  readonly active: number;
  readonly now: Date;
}

export interface DecidedShareLink {
  readonly label: string | null;
  readonly expiresAt: Date | null;
}

/** An empty label is no label; the active count is checked again under the repository's lock. */
export function decideShareLink(
  input: ShareLinkInput,
  context: ShareLinkContext
): Result<DecidedShareLink, InvalidShareLink | ShareLinkLimit> {
  const label = normalizePlainText(input.label ?? '');
  if (!withinLength(label, { minLength: 0, maxLength: SHARE_LINK_LABEL_MAX_LENGTH })) {
    return err(invalidShareLink(`A label is at most ${SHARE_LINK_LABEL_MAX_LENGTH} characters`));
  }
  if (context.active >= MAX_ACTIVE_SHARE_LINKS) return err(shareLinkLimit(context.target));
  return ok({
    label: label === '' ? null : label,
    expiresAt: shareLinkExpiresAt(input.expiresIn, context.now),
  });
}

/**
 * What a token proves about one target. A token that names nothing, or names another target, proves
 * nothing and is not an error: the read decides as it would without it, so a guessed token learns
 * nothing. A dead link of this target is `SHARE_LINK_EXPIRED`, which the page says in words.
 */
export function decideShareLinkUse(
  link: ShareLink | null,
  context: { readonly target: ShareLinkTarget; readonly now: Date }
): Result<ShareGrant | null, ShareLinkExpired> {
  const { target, now } = context;
  if (!link || link.targetType !== target.targetType || link.targetId !== target.targetId) {
    return ok(null);
  }
  if (shareLinkState(link, now) !== 'active') return err(shareLinkExpired(target));
  return ok({ targetType: link.targetType, targetId: link.targetId });
}
