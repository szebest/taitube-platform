import { assertNever } from '@kit/result';
import { PlaylistRulesSchema, type PlaylistView } from '@vp/api-contracts';
import type {
  SmartPlaylistCondition,
  SmartPlaylistFormat,
  SmartPlaylistRules,
  SmartPlaylistSort,
} from '@vp/domain';

const SECONDS_PER_MINUTE = 60;

const DEFAULT_SMART_LIMIT = 50;
const DEFAULT_NEWER_THAN_DAYS = 30;
const DEFAULT_MINUTES = [10, 30] as const;

export type ConditionField = SmartPlaylistCondition['field'];
export type DurationOp = 'under' | 'over' | 'between';

/** A channel picked in the form; its name is null until read, for rules loaded from the API. */
export interface ChannelDraft {
  id: string;
  displayName: string | null;
}

type ConditionOperands =
  | { field: 'channel'; channels: ChannelDraft[] }
  | { field: 'tag'; tags: string[] }
  | { field: 'category'; categoryId: string | null }
  | { field: 'duration'; op: DurationOp; minutes: number[] }
  | { field: 'format'; format: SmartPlaylistFormat }
  | { field: 'newer_than'; days: number }
  | { field: 'unwatched' };

/**
 * One condition as the form edits it: durations in whole minutes, channels with their names, and a
 * `key` that names the row while others are added and removed around it.
 */
export type ConditionDraft = ConditionOperands & { key: string };

export interface RulesDraft {
  match: SmartPlaylistRules['match'];
  conditions: ConditionDraft[];
  sort: SmartPlaylistSort;
  limit: number;
}

export type PlaylistRulesBody = NonNullable<PlaylistView['rules']>;

export const EMPTY_RULES: RulesDraft = {
  match: 'all',
  conditions: [],
  sort: 'newest',
  limit: DEFAULT_SMART_LIMIT,
};

/** A fresh condition of `field`, with the operands a viewer most often wants. */
export function draftCondition(field: ConditionField): ConditionDraft {
  return { ...operandsOf(field), key: crypto.randomUUID() };
}

function operandsOf(field: ConditionField): ConditionOperands {
  switch (field) {
    case 'channel':
      return { field, channels: [] };
    case 'tag':
      return { field, tags: [] };
    case 'category':
      return { field, categoryId: null };
    case 'duration':
      return { field, op: 'under', minutes: [DEFAULT_MINUTES[0]] };
    case 'format':
      return { field, format: 'long' };
    case 'newer_than':
      return { field, days: DEFAULT_NEWER_THAN_DAYS };
    case 'unwatched':
      return { field };
    default:
      return assertNever(field, 'ConditionField');
  }
}

/** Two minutes for a range, one for a bound, keeping what the viewer had set. */
export function minutesFor(op: DurationOp, minutes: readonly number[]): number[] {
  const first = minutes[0] ?? DEFAULT_MINUTES[0];
  return op === 'between'
    ? [first, Math.max(minutes[1] ?? DEFAULT_MINUTES[1], first + 1)]
    : [first];
}

function conditionToOperands(condition: SmartPlaylistCondition): ConditionOperands {
  switch (condition.field) {
    case 'channel':
      return {
        field: 'channel',
        channels: condition.channelIds.map((id) => ({ id, displayName: null })),
      };
    case 'tag':
      return { field: 'tag', tags: [...condition.tags] };
    case 'category':
      return { field: 'category', categoryId: condition.categoryId };
    case 'duration': {
      const { duration } = condition;
      const minutes =
        duration.op === 'between' ? [duration.minSeconds, duration.maxSeconds] : [duration.seconds];
      return {
        field: 'duration',
        op: duration.op,
        minutes: minutes.map((seconds) => Math.round(seconds / SECONDS_PER_MINUTE)),
      };
    }
    case 'format':
      return { field: 'format', format: condition.format };
    case 'newer_than':
      return { field: 'newer_than', days: condition.days };
    case 'unwatched':
      return { field: 'unwatched' };
    default:
      return assertNever(condition, 'SmartPlaylistCondition');
  }
}

/** The form's starting point: a smart playlist's rules, or the defaults for a new one. */
export function rulesToDraft(rules: SmartPlaylistRules | null): RulesDraft {
  if (rules === null) {
    return EMPTY_RULES;
  }

  return {
    ...rules,
    conditions: rules.conditions.map((condition) => ({
      ...conditionToOperands(condition),
      key: crypto.randomUUID(),
    })),
  };
}

function draftToCondition(draft: ConditionDraft): SmartPlaylistCondition {
  switch (draft.field) {
    case 'channel':
      return { field: 'channel', channelIds: draft.channels.map(({ id }) => id) };
    case 'tag':
      return { field: 'tag', tags: draft.tags };
    case 'category':
      return { field: 'category', categoryId: draft.categoryId ?? '' };
    case 'duration': {
      const [first = 0, second = 0] = draft.minutes.map((minutes) => minutes * SECONDS_PER_MINUTE);
      return {
        field: 'duration',
        duration:
          draft.op === 'between'
            ? { op: 'between', minSeconds: first, maxSeconds: second }
            : { op: draft.op, seconds: first },
      };
    }
    case 'format':
      return { field: 'format', format: draft.format };
    case 'newer_than':
      return { field: 'newer_than', days: draft.days };
    case 'unwatched':
      return { field: 'unwatched' };
    default:
      return assertNever(draft, 'ConditionDraft');
  }
}

/** The body `createPlaylist` and `updatePlaylist` take for the rules the form holds. */
export function draftToRules({ match, conditions, sort, limit }: RulesDraft): PlaylistRulesBody {
  return { match, conditions: conditions.map(draftToCondition), sort, limit };
}

/** A form validator: the rules the API would refuse keep the form from being sent. */
export function validateRulesDraft({ value }: { value: RulesDraft }): string | undefined {
  return PlaylistRulesSchema.safeParse(draftToRules(value)).success ? undefined : 'invalid';
}
