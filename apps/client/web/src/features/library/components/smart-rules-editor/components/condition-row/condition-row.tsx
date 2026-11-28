import { assertNever } from '@kit/result';
import { Field, Select, TagInput } from '@kit/ui';
import { SMART_PLAYLIST_FORMATS, SMART_PLAYLIST_MAX_TAGS } from '@vp/domain';
import { SmartRuleBuilder } from '#app/components/playlist/smart-rule-builder';
import {
  type ConditionDraft,
  type ConditionField,
  draftCondition,
} from '#app/features/library/utils/rules-form';
import { useT } from '#app/lib/messages';
import { CategoryOperand } from '../category-operand/category-operand';
import { ChannelOperand } from '../channel-operand/channel-operand';
import { DurationOperand } from '../duration-operand/duration-operand';
import { NumberOperand } from '../number-operand/number-operand';

const FIELDS = [
  'channel',
  'tag',
  'category',
  'duration',
  'format',
  'newer_than',
  'unwatched',
] as const satisfies readonly ConditionField[];

const MAX_NEWER_THAN_DAYS = 365;

export interface ConditionRowProps {
  /** Its place among the conditions, counted from 1, for the names of its controls. */
  position: number;
  condition: ConditionDraft;
  onChange: (condition: ConditionDraft) => void;
  onRemove: () => void;
}

/** One condition: which field it tests, and the operands that field takes. */
export function ConditionRow({ position, condition, onChange, onRemove }: ConditionRowProps) {
  const { tOr } = useT();

  const operands = () => {
    switch (condition.field) {
      case 'channel':
        return (
          <ChannelOperand
            channels={condition.channels}
            onChange={(channels) => onChange({ ...condition, channels })}
          />
        );
      case 'tag':
        return (
          <Field.Root className="min-w-0 flex-1 basis-60">
            <Field.Label className="sr-only">
              {tOr('playlistTools.tagsLabel', { max: SMART_PLAYLIST_MAX_TAGS }, '')}
            </Field.Label>
            <TagInput
              value={condition.tags}
              max={SMART_PLAYLIST_MAX_TAGS}
              placeholder={tOr('playlistTools.tagsLabel', { max: SMART_PLAYLIST_MAX_TAGS }, '')}
              onValueChange={(tags) => onChange({ ...condition, tags })}
            />
          </Field.Root>
        );
      case 'category':
        return (
          <CategoryOperand
            categoryId={condition.categoryId}
            onPick={(categoryId) => onChange({ ...condition, categoryId })}
          />
        );
      case 'duration':
        return <DurationOperand condition={condition} onChange={onChange} />;
      case 'format':
        return (
          <Select.Root
            value={condition.format}
            onValueChange={(next) => {
              const format = SMART_PLAYLIST_FORMATS.find((option) => option === next);
              if (format) onChange({ ...condition, format });
            }}
          >
            <Select.Trigger aria-label={tOr('playlistTools.formatLabel', {}, '')}>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {SMART_PLAYLIST_FORMATS.map((format) => (
                <Select.Item key={format} value={format}>
                  {tOr('playlistTools.format', { format }, '')}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        );
      case 'newer_than':
        return (
          <NumberOperand
            label={tOr('playlistTools.daysLabel', {}, '')}
            value={condition.days}
            max={MAX_NEWER_THAN_DAYS}
            shown={tOr('playlistTools.days', { count: condition.days }, '')}
            onChange={(days) => onChange({ ...condition, days })}
          />
        );
      case 'unwatched':
        return (
          <span className="text-body-sm text-fg-muted">
            {tOr('playlistTools.unwatchedHint', {}, '')}
          </span>
        );
      default:
        return assertNever(condition, 'ConditionDraft');
    }
  };

  return (
    <SmartRuleBuilder.Condition
      aria-label={tOr('playlistTools.conditionLabel', { position }, '')}
      removeLabel={tOr('playlistTools.removeCondition', { position }, '')}
      onRemove={onRemove}
    >
      <Select.Root
        value={condition.field}
        onValueChange={(next) => {
          const field = FIELDS.find((option) => option === next);
          if (field && field !== condition.field) {
            onChange({ ...draftCondition(field), key: condition.key });
          }
        }}
      >
        <Select.Trigger aria-label={tOr('playlistTools.fieldLabel', { position }, '')}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {FIELDS.map((field) => (
            <Select.Item key={field} value={field}>
              {tOr('playlistTools.field', { field }, '')}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      {operands()}
    </SmartRuleBuilder.Condition>
  );
}
