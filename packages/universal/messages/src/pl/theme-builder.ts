import { dt } from '../define';

export const themeBuilder = {
  ground: dt('Kolor strony w Twoim motywie'),
  accent: dt('Akcent Twojego motywu'),
  use: dt('Użyj tego motywu'),
  passes: dt('Każda para tekstu i obrysu jest czytelna.'),
  fails: dt('Ten motyw nie został zapisany: pary poniżej progu kontrastu: {count}.'),
  refused: dt(
    'Ten motyw nie został zapisany: wybierz ciemniejszy lub jaśniejszy kolor strony, by akcenty były na nim czytelne.'
  ),
  failure: dt('{mode}: {label}, {ratio:number}:1 z {floor:number}:1', {
    number: { ratio: { maximumFractionDigits: 1 }, floor: { maximumFractionDigits: 1 } },
  }),
} as const;
