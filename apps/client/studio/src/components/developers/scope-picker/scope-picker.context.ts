import { createCompoundContext } from '@kit/ui';
import type { ApiScope } from '@vp/domain';

export const [ScopePickerContext, useScopePicker] = createCompoundContext<{
  value: readonly ApiScope[];
  toggle: (scope: ApiScope, chosen: boolean) => void;
  disabled: boolean;
}>('ScopePicker');

export const [ScopeGroupContext, useScopeGroup] = createCompoundContext<{ titleId: string }>(
  'ScopePicker.Group'
);
