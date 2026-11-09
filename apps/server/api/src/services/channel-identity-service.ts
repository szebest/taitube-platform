import type {
  ChannelAuditRepositoryPort,
  ChannelHandleHistoryRepositoryPort,
  ChannelRepositoryPort,
} from '@vp/core/repositories';
import {
  type Channel,
  type ChannelAuditField,
  HANDLE_RESERVATION_DAYS,
  type UpdateChannelInput,
} from '@vp/domain';
import {
  type ChannelNotFound,
  type ClaimHandleFailure,
  type HandleChangeTooSoon,
  type InvalidBrandColor,
  channelNotFound,
  decideHandleChange,
  decideHandleClaim,
  validateBrandColor,
} from '@vp/domain-rules';
import { MS_PER_DAY } from '@vp/domain/time';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, andThen, err, isErr, ok } from '@vp/result';
import {
  type InvalidBannerLink,
  type InvalidChannelLinks,
  type InvalidContactEmail,
  validateBannerLink,
  validateChannelLinks,
  validateContactEmail,
} from '@vp/validation';
import { findChannelByIdOrHandle } from './channel-lookup';

const HANDLE_RESERVATION_MS = HANDLE_RESERVATION_DAYS * MS_PER_DAY;

export interface ChannelIdentityServiceDeps {
  channels: ChannelRepositoryPort;
  handleHistory: ChannelHandleHistoryRepositoryPort;
  audit: ChannelAuditRepositoryPort;
  now: () => number;
}

export interface IdentityInput {
  handle?: string;
  brandColor?: string | null;
  links?: readonly { label: string; url: string }[];
  country?: string | null;
  contactEmail?: string | null;
  bannerLink?: { label: string; url: string } | null;
}

export type IdentityPatch = Pick<
  UpdateChannelInput,
  'handle' | 'handleChangedAt' | 'brandColor' | 'links' | 'country' | 'contactEmail' | 'bannerLink'
>;

export type IdentityFailure =
  | ClaimHandleFailure
  | HandleChangeTooSoon
  | InvalidBrandColor
  | InvalidChannelLinks
  | InvalidBannerLink
  | InvalidContactEmail
  | DatabaseUnavailable;

export interface PublicChannelMatch {
  channel: Channel;
  /** The retired handle the request named, when it resolved through the history. */
  redirectedFrom: string | null;
}

/** What identifies a channel and how it can be reached: its handle and its history, links, contact and banner link. */
export class ChannelIdentityService {
  constructor(private readonly deps: ChannelIdentityServiceDeps) {}

  /** The validated patch of an edit; the handle part is there only when the handle really changes. */
  async decide(
    existing: Channel,
    input: IdentityInput
  ): Promise<Result<IdentityPatch, IdentityFailure>> {
    const patch: IdentityPatch = {};

    if (input.links !== undefined) {
      const links = validateChannelLinks(input.links);
      if (isErr(links)) return links;
      patch.links = links.value;
    }
    if (input.brandColor !== undefined) {
      const brandColor = validateBrandColor(input.brandColor);
      if (isErr(brandColor)) return brandColor;
      patch.brandColor = brandColor.value;
    }
    if (input.contactEmail !== undefined) {
      const email = validateContactEmail(input.contactEmail);
      if (isErr(email)) return email;
      patch.contactEmail = email.value;
    }
    if (input.bannerLink !== undefined) {
      const link = validateBannerLink(input.bannerLink);
      if (isErr(link)) return link;
      patch.bannerLink = link.value;
    }
    if (input.country !== undefined) patch.country = input.country;

    if (input.handle !== undefined) {
      const handle = await this.decideHandle(existing, input.handle);
      if (isErr(handle)) return handle;
      Object.assign(patch, handle.value);
    }
    return ok(patch);
  }

  private async decideHandle(
    existing: Channel,
    requested: string
  ): Promise<Result<Pick<IdentityPatch, 'handle' | 'handleChangedAt'>, IdentityFailure>> {
    const { channels, handleHistory } = this.deps;
    const now = new Date(this.deps.now());

    const heldBy = await channels.findByHandle(requested);
    if (isErr(heldBy)) return heldBy;
    const retired = await handleHistory.findByHandle(requested);
    if (isErr(retired)) return retired;

    const claimed = decideHandleClaim({
      handle: requested,
      heldBy: heldBy.value,
      claimantChannelId: existing.id,
      retirement: { retired: retired.value, now },
    });
    return andThen(claimed, (handle) =>
      andThen(
        decideHandleChange({
          currentHandle: existing.handle,
          nextHandle: handle,
          handleChangedAt: existing.handleChangedAt,
          now,
        }),
        ({ changes }) => ok(changes ? { handle, handleChangedAt: now } : {})
      )
    );
  }

  async recordChange(
    user: UserContext,
    channelId: string,
    fields: ChannelAuditField[]
  ): Promise<Result<void, DatabaseUnavailable>> {
    const appended = await this.deps.audit.append({
      channelId,
      actorUserId: user.id,
      action: 'channel.updated',
      targetType: 'channel',
      targetId: channelId,
      meta: { fields },
    });
    return isErr(appended) ? appended : ok();
  }

  /** A current handle, an id, or a handle given up in the last 90 days, which resolves with `redirectedFrom`. */
  async findPublic(
    idOrHandle: string
  ): Promise<Result<PublicChannelMatch, ChannelNotFound | DatabaseUnavailable>> {
    const found = await findChannelByIdOrHandle(this.deps.channels, idOrHandle);
    if (!isErr(found)) return ok({ channel: found.value, redirectedFrom: null });
    if (found.error.code !== ErrorCodes.CHANNEL_NOT_FOUND) return found;

    const handle = idOrHandle.replace(/^@/, '');
    const retired = await this.deps.handleHistory.findByHandle(handle);
    if (isErr(retired)) return retired;
    if (!retired.value || this.isReleased(retired.value.retiredAt)) return found;

    const channel = await this.deps.channels.findById(retired.value.channelId);
    if (isErr(channel)) return channel;
    return channel.value
      ? ok({ channel: channel.value, redirectedFrom: retired.value.handle })
      : err(channelNotFound(idOrHandle));
  }

  /** The address of a channel that set one; absent when it has none, as for a channel that is not there. */
  async revealContact(
    channelId: string
  ): Promise<Result<{ email: string }, ChannelNotFound | DatabaseUnavailable>> {
    const channel = await this.deps.channels.findById(channelId);
    if (isErr(channel)) return channel;
    return channel.value?.contactEmail
      ? ok({ email: channel.value.contactEmail })
      : err(channelNotFound(channelId));
  }

  private isReleased(retiredAt: Date): boolean {
    return this.deps.now() - retiredAt.getTime() >= HANDLE_RESERVATION_MS;
  }
}
