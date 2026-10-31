import { urlModals } from '../registry';

describe('the app modal registry', () => {
  it.each([{ scope: 'history' }, { scope: 'searches' }])(
    'keeps the clear-history modal for the $scope scope',
    ({ scope }) => {
      expect(urlModals.searchSchema.parse({ modal: 'clear-history', scope })).toEqual({
        modal: 'clear-history',
        scope,
      });
    }
  );

  it.each([{ scope: 'comments' }, {}])(
    'drops a clear-history modal with the scope %j',
    (params) => {
      expect(urlModals.searchSchema.parse({ modal: 'clear-history', ...params })).toEqual({});
    }
  );

  it('keeps the save-to-playlist modal for a video id, and the new-playlist modal as it is', () => {
    const videoId = '0190c3a0-5e1d-7000-8000-000000000007';

    expect(urlModals.searchSchema.parse({ modal: 'save-to-playlist', videoId })).toEqual({
      modal: 'save-to-playlist',
      videoId,
    });
    expect(urlModals.searchSchema.parse({ modal: 'new-playlist' })).toEqual({
      modal: 'new-playlist',
    });
  });

  it('drops a save-to-playlist modal that names no video', () => {
    expect(urlModals.searchSchema.parse({ modal: 'save-to-playlist', videoId: 'nope' })).toEqual(
      {}
    );
  });

  it('drops the keys of a modal nothing registered', () => {
    expect(urlModals.searchSchema.parse({ modal: 'share', videoId: 'v1' })).toEqual({});
  });

  it('refuses an id that is not registered', () => {
    const types = () => {
      // @ts-expect-error no modal has this id
      urlModals.useUrlModal('share');
    };

    expect(types).toBeTypeOf('function');
  });
});
