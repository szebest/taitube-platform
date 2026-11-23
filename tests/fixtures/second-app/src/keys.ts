import { defineKeyspace } from '@kit/keyspace';

export const ShopKeys = defineKeyspace('quill', (key) => ({
  shelf: (shelfId: string) => key('shelf', shelfId),
  basket: (customerId: string) => key('basket', customerId),
}));
