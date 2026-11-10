import { ScreeningServices } from '../screening-tokens';
import { Services } from '../service-tokens';

describe('apps/server/api/composition: screening tokens', () => {
  it('are the very tokens Services holds, so a provider registered on one resolves through the other', () => {
    expect(Services.ScreeningService).toBe(ScreeningServices.ScreeningService);
    expect(Services.MetadataScreening).toBe(ScreeningServices.MetadataScreening);
  });
});
