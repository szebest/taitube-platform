import {
  PickOfTheDayActions,
  PickOfTheDayKicker,
  PickOfTheDayNote,
  PickOfTheDayRoot,
  PickOfTheDayWindow,
} from './pick-of-the-day';

export const PickOfTheDay = {
  Root: PickOfTheDayRoot,
  Kicker: PickOfTheDayKicker,
  Note: PickOfTheDayNote,
  Window: PickOfTheDayWindow,
  Actions: PickOfTheDayActions,
};
export { PickOfTheDaySkeleton } from './pick-of-the-day';
export { usePickOfTheDay } from './pick-of-the-day.context';
export { pickOfTheDayStyles } from './pick-of-the-day.variants';
