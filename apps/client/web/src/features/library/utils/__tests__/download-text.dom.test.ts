import { downloadText } from '../download-text';

describe('apps/client/web: downloadText', () => {
  it('clicks a link to an object URL of the text under the file name, then lets the URL go', async () => {
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
    const revoked = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      expect([this.href, this.download]).toEqual(['blob:export', 'trips.csv']);
    });

    downloadText('a,b', 'trips.csv', 'text/csv');

    const blob = created.mock.calls[0]?.[0] as Blob;
    expect([blob.type, await blob.text()]).toEqual(['text/csv', 'a,b']);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(revoked).toHaveBeenCalledWith('blob:export');
  });
});
