import {
  ScopePickerGroup,
  ScopePickerGroupTitle,
  ScopePickerItem,
  ScopePickerLegend,
  ScopePickerRoot,
} from './scope-picker';

export const ScopePicker = {
  Root: ScopePickerRoot,
  Legend: ScopePickerLegend,
  Group: ScopePickerGroup,
  GroupTitle: ScopePickerGroupTitle,
  Item: ScopePickerItem,
};
export { useScopePicker } from './scope-picker.context';
