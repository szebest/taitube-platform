import { Field, SegmentedControl, Select, Slider } from '@kit/ui';
import {
  SMART_PLAYLIST_MATCHES,
  SMART_PLAYLIST_MAX_CONDITIONS,
  SMART_PLAYLIST_MAX_LIMIT,
  SMART_PLAYLIST_SORTS,
} from '@vp/domain';
import { SmartRuleBuilder } from '#app/components/playlist/smart-rule-builder';
import {
  type ConditionDraft,
  draftCondition,
  type RulesDraft,
} from '#app/features/library/utils/rules-form';
import { useT } from '#app/lib/messages';
import { ConditionRow } from './components/condition-row/condition-row';

export interface SmartRulesEditorProps {
  value: RulesDraft;
  onChange: (rules: RulesDraft) => void;
}

/** A smart playlist's rules as rows of conditions, matched all or any, with their sort and size. */
export function SmartRulesEditor({ value, onChange }: SmartRulesEditorProps) {
  const { tOr } = useT();

  const { match, conditions, sort, limit } = value;
  const set = (patch: Partial<RulesDraft>) => onChange({ ...value, ...patch });
  const replace = (index: number, condition: ConditionDraft) =>
    set({ conditions: conditions.map((current, at) => (at === index ? condition : current)) });

  return (
    <SmartRuleBuilder.Root aria-label={tOr('playlistTools.rulesLabel', {}, '')}>
      <SmartRuleBuilder.Match>
        <span className="text-label">{tOr('playlistTools.matchLabel', {}, '')}</span>
        <SegmentedControl.Root
          aria-label={tOr('playlistTools.matchLabel', {}, '')}
          value={match}
          onValueChange={(next) => {
            const picked = SMART_PLAYLIST_MATCHES.find((option) => option === next);
            if (picked) set({ match: picked });
          }}
        >
          {SMART_PLAYLIST_MATCHES.map((option) => (
            <SegmentedControl.Item key={option} value={option}>
              {tOr('playlistTools.match', { mode: option }, '')}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      </SmartRuleBuilder.Match>
      {conditions.length === 0 ? (
        <p className="m-0 text-body-sm text-fg-muted">
          {tOr('playlistTools.noConditions', {}, '')}
        </p>
      ) : (
        <SmartRuleBuilder.Conditions>
          {conditions.map((condition, index) => (
            <ConditionRow
              key={condition.key}
              position={index + 1}
              condition={condition}
              onChange={(next) => replace(index, next)}
              onRemove={() => set({ conditions: conditions.filter((_, at) => at !== index) })}
            />
          ))}
        </SmartRuleBuilder.Conditions>
      )}
      <SmartRuleBuilder.Add
        disabled={conditions.length >= SMART_PLAYLIST_MAX_CONDITIONS}
        onClick={() => set({ conditions: [...conditions, draftCondition('channel')] })}
      >
        {tOr('playlistTools.addCondition', {}, '')}
      </SmartRuleBuilder.Add>
      <SmartRuleBuilder.Footer>
        <Field.Root className="basis-48">
          <Field.Label>{tOr('playlistTools.sortLabel', {}, '')}</Field.Label>
          <Select.Root
            value={sort}
            onValueChange={(next) => {
              const picked = SMART_PLAYLIST_SORTS.find((option) => option === next);
              if (picked) set({ sort: picked });
            }}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {SMART_PLAYLIST_SORTS.map((option) => (
                <Select.Item key={option} value={option}>
                  {tOr('playlistTools.sort', { sort: option }, '')}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Field.Root>
        <Field.Root className="min-w-0 flex-1 basis-48">
          <Field.Label>{tOr('playlistTools.limitLabel', {}, '')}</Field.Label>
          <div className="flex items-center gap-inline">
            <Slider.Root
              min={1}
              max={SMART_PLAYLIST_MAX_LIMIT}
              value={[limit]}
              onValueChange={([next = limit]) => set({ limit: next })}
            >
              <Slider.Thumb aria-label={tOr('playlistTools.limitLabel', {}, '')} />
            </Slider.Root>
            <span className="shrink-0 tabular-nums text-body-sm">
              {tOr('playlistTools.limit', { count: limit }, '')}
            </span>
          </div>
        </Field.Root>
      </SmartRuleBuilder.Footer>
    </SmartRuleBuilder.Root>
  );
}
