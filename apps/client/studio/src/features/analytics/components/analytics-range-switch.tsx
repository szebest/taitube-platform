import { ANALYTICS_RANGES } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { SegmentedControl } from '@vp/ui';

import type { AnalyticsRange } from '../types';

export interface AnalyticsRangeSwitchProps {
  value: AnalyticsRange;
  onChange: (range: AnalyticsRange) => void;
}

export function AnalyticsRangeSwitch({ value, onChange }: AnalyticsRangeSwitchProps) {
  const { tOr } = useT();

  return (
    <SegmentedControl.Root
      aria-label={tOr('studio.analyticsRange', {}, '')}
      value={value}
      onValueChange={(next) => {
        const range = ANALYTICS_RANGES.find((known) => known === next);
        if (range !== undefined) {
          onChange(range);
        }
      }}
    >
      {ANALYTICS_RANGES.map((range) => (
        <SegmentedControl.Item key={range} value={range}>
          {tOr('studio.analyticsRangeOption', { range }, '')}
        </SegmentedControl.Item>
      ))}
    </SegmentedControl.Root>
  );
}
