import { SegmentedControl, type SegmentedControlRootProps, useUiCopy } from '@vp/ui';
import type { DisclosureOption } from './types';

export interface DisclosureControlProps extends Omit<
  SegmentedControlRootProps,
  'value' | 'defaultValue' | 'onValueChange' | 'children' | 'tone'
> {
  /** `null` picks neither: the channel's default applies. */
  value: DisclosureOption | null;
  onValueChange: (value: DisclosureOption) => void;
}

const isDisclosure = (value: string): value is DisclosureOption =>
  value === 'silent' || value === 'visible';

/** Whether the author of a moderated comment is told: Silent says nothing, Visible says what happened and why. */
export function DisclosureControl({ value, onValueChange, ...props }: DisclosureControlProps) {
  const { disclosureLabel, disclosureSilent, disclosureVisible } = useUiCopy();

  return (
    <SegmentedControl.Root
      data-slot="disclosure-control"
      aria-label={disclosureLabel}
      value={value ?? ''}
      onValueChange={(next) => isDisclosure(next) && onValueChange(next)}
      {...props}
    >
      <SegmentedControl.Item value="silent">{disclosureSilent}</SegmentedControl.Item>
      <SegmentedControl.Item value="visible">{disclosureVisible}</SegmentedControl.Item>
    </SegmentedControl.Root>
  );
}
