import {
  SmartRuleBuilderAdd,
  SmartRuleBuilderCondition,
  SmartRuleBuilderConditions,
  SmartRuleBuilderFooter,
  SmartRuleBuilderMatch,
  SmartRuleBuilderRoot,
} from './smart-rule-builder';

export const SmartRuleBuilder = {
  Root: SmartRuleBuilderRoot,
  Match: SmartRuleBuilderMatch,
  Conditions: SmartRuleBuilderConditions,
  Condition: SmartRuleBuilderCondition,
  Add: SmartRuleBuilderAdd,
  Footer: SmartRuleBuilderFooter,
};

export type { SmartRuleBuilderConditionProps } from './smart-rule-builder';
