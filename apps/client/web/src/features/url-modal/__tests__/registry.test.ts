import { urlModals } from '../registry';

describe('the app modal registry', () => {
  it('drops every modal key until a feature registers its modal', () => {
    expect(urlModals.searchSchema.parse({ modal: 'share', videoId: 'v1' })).toEqual({});
  });

  it('has no id to open yet', () => {
    const types = () => {
      // @ts-expect-error no modal is registered
      urlModals.useUrlModal('share');
    };

    expect(types).toBeTypeOf('function');
  });
});
