import { Services } from '../service-tokens';
import { VideoToolsServices } from '../video-tools-tokens';

describe('apps/server/api/composition: video tools tokens', () => {
  it('are the very tokens Services holds, so a provider registered on one resolves through the other', () => {
    for (const [name, tokenOf] of Object.entries(VideoToolsServices)) {
      expect(Services[name as keyof typeof VideoToolsServices]).toBe(tokenOf);
    }
  });
});
