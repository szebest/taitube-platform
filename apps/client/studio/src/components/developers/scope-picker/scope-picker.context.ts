import type { ApiScope } from '@vp/domain';
import { createCompoundContext } from '@vp/ui';

export const [ScopePickerContext, useScopePicker] = createCompoundContext<{
  value: readonly ApiScope[];
  toggle: (scope: ApiScope, chosen: boolean) => void;
  disabled: boolean;
}>('ScopePicker');

export const [ScopeGroupContext, useScopeGroup] = createCompoundContext<{ titleId: string }>(
  'ScopePicker.Group'
);
