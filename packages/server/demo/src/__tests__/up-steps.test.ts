import { planLabel, runLabel, UP_STEPS } from '../up-steps';

describe('demo: up steps', () => {
  it.each(UP_STEPS.map((step, index) => ({ step, index })))(
    'labels $step as step $index of the list in a run and in a plan',
    ({ step, index }) => {
      expect(runLabel(step)).toBe(`[${index + 1}/${UP_STEPS.length}] ${step}`);
      expect(planLabel(step)).toBe(`${index + 1} ${step}`);
    }
  );
});
