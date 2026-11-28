import type { ForcedSubject } from '@casl/ability';
import { defineMachine } from '@kit/machine';
import { createAbilityFactory, type RuleSet } from '@kit/permissions';
import { defineFieldFailures } from '@kit/validation';
import { ShopErrorCodes } from './errors';

type ShopAction = 'browse' | 'restock';
type ShopSubject = 'Shelf' | ({ shopId: string } & ForcedSubject<'Shelf'>);
export type Staff = { id: string; role: string } | null;

const browseShelves: RuleSet<ShopAction, ShopSubject, Staff> = (_staff, { can }) =>
  can('browse', 'Shelf');
const restockOwnShop: RuleSet<ShopAction, ShopSubject, Staff> = (staff, { can }) => {
  if (staff?.role === 'bookseller') can('restock', 'Shelf', { shopId: 'quill-oulu' });
};

export const abilityFor = createAbilityFactory([browseShelves, restockOwnShop]);

export const orderMachine = defineMachine({
  name: 'quill-order',
  states: ['basket', 'paid', 'shipped'],
  initial: ['basket'],
  final: ['shipped'],
  events: {
    pay: { from: ['basket'], to: 'paid' },
    ship: { from: ['paid'], to: 'shipped' },
  },
});

export const shelfFailures = defineFieldFailures(ShopErrorCodes.codes.SHELF_FULL);
