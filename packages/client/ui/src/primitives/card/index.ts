import {
  CardAction,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardRoot,
  CardTitle,
} from './card';

export const Card = {
  Root: CardRoot,
  Header: CardHeader,
  Title: CardTitle,
  Description: CardDescription,
  Action: CardAction,
  Body: CardBody,
  Footer: CardFooter,
};
export type { CardActionProps, CardPartProps, CardRootProps, CardTitleProps } from './card';
export { useCard } from './card.context';
export { cardStyles } from './card.variants';
export type { CardElevation, CardFill, CardSize } from './types';
