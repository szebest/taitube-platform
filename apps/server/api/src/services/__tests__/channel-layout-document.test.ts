import { standardChannelLayout } from '@vp/domain';
import { readStoredLayout } from '../channel-layout-document';

describe('readStoredLayout', () => {
  it('reads a current document and answers null for one that is not a layout', () => {
    expect(readStoredLayout(standardChannelLayout())).toEqual(standardChannelLayout());
    expect(readStoredLayout({ schemaVersion: 1, tabs: 'nope' })).toBeNull();
    expect(readStoredLayout({ schemaVersion: 99 })).toBeNull();
    expect(readStoredLayout(null)).toBeNull();
  });
});
