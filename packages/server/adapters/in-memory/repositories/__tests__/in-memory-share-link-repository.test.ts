import { expectOk } from '@kit/testing/result';
import { NO_SHARE_LINK_TOTALS } from '@vp/domain';
import { ACCESS_DAY, linkId, shareLink } from '../../../__tests__/contract/access-fixtures';
import { describeShareLinkRepositoryContract } from '../../../__tests__/contract/share-link-repository.contract';
import { inMemorySubject } from '../../../__tests__/contract/subjects';
import { InMemoryShareLinkRepository } from '../in-memory-share-link-repository';

describeShareLinkRepositoryContract(inMemorySubject);

describe('InMemoryShareLinkRepository', () => {
  it('clears the links and the numbers flushed for them', async () => {
    const links = new InMemoryShareLinkRepository();
    expectOk(await links.create(shareLink(1), 50));
    links.addStats([
      { linkId: linkId(1), viewDate: ACCESS_DAY, opens: 2, views: 1, watchSeconds: 3 },
    ]);

    links.clear();
    expectOk(await links.create(shareLink(1), 50));

    expect(expectOk(await links.totalsFor([linkId(1)])).get(linkId(1))).toEqual(
      NO_SHARE_LINK_TOTALS
    );
  });
});
