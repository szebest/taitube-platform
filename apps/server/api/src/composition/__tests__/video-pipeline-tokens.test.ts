import { Services } from '../service-tokens';
import { VideoPipelineServices } from '../video-pipeline-tokens';

describe('apps/server/api/composition: video pipeline tokens', () => {
  it('are the very tokens Services holds, so a provider registered on one resolves through the other', () => {
    for (const [name, tokenOf] of Object.entries(VideoPipelineServices)) {
      expect(Services[name as keyof typeof VideoPipelineServices]).toBe(tokenOf);
    }
  });
});
