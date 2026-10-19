import { fontSizeGroup } from '../font-size';
import { describeTokenGroupContract } from './token-group-contract';

describe('fontSizeGroup', () => {
  describeTokenGroupContract('fontSize', fontSizeGroup);
});
