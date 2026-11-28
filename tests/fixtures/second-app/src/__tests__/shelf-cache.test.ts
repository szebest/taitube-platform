import { describeCacheClientContract } from '@kit/ports/contract';
import { ShelfCache } from '../shelf-cache';

describeCacheClientContract(async () => ({ cache: new ShelfCache(), close: async () => {} }));
