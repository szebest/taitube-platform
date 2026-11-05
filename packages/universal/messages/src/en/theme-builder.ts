import { dt } from '../define';

export const themeBuilder = {
  ground: dt('Page colour of your theme'),
  accent: dt('Accent of your theme'),
  use: dt('Use this theme'),
  passes: dt('Every text and outline pair is readable.'),
  fails: dt('This theme is not saved: {count} pairs are under their contrast floor.'),
  refused: dt(
    'This theme is not saved: pick a darker or lighter page colour so accents stay readable on it.'
  ),
  failure: dt('{mode}: {label}, {ratio:number}:1 of {floor:number}:1', {
    number: { ratio: { maximumFractionDigits: 1 }, floor: { maximumFractionDigits: 1 } },
  }),
} as const;
