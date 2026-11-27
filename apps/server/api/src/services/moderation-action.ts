import type { CommentActionBody } from '@vp/api-contracts';
import type { CommentModerationAction, DisclosureDefaults, DisclosureRule } from '@vp/domain';

const DISCLOSURE_RULE = {
  hold: 'manual_hold',
  hide: 'hide',
  remove: 'remove',
} as const satisfies Record<string, DisclosureRule>;

/** The action as the domain takes it: the disclosure is the moderator's, else the channel default. */
export function actionOf(
  body: CommentActionBody,
  defaults: DisclosureDefaults
): CommentModerationAction {
  switch (body.action) {
    case 'approve':
    case 'unhide':
      return { action: body.action };
    default:
      return {
        ...body,
        disclosure: body.disclosure ?? defaults[DISCLOSURE_RULE[body.action]],
      };
  }
}
