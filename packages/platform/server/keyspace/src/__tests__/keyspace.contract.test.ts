import { describeKeyspaceContract } from '../contract';
import { defineKeyspace } from '../keyspace';

describeKeyspaceContract(() =>
  defineKeyspace('acme', (key) => ({
    catalogue: key('cache', 'catalogue', 'v1'),
    basket: (userId: string) => key('user', userId, 'basket'),
    pair: (userId: string, itemId: string) => key('user', userId, 'item', itemId),
  }))
);
