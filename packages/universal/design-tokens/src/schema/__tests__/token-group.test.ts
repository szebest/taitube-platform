import { MAX_APPEARANCE_OVERRIDES, TOKEN_GROUP_PATTERN } from '@vp/domain/settings';
import { TOKEN_GROUPS, tokenGroups } from '../token-group';

const pathsByGroup = () =>
  Object.fromEntries(TOKEN_GROUPS.map((group) => [group, tokenGroups[group].path]));

describe('tokenGroups', () => {
  it('maps each camelCase group key to its kebab path', () => {
    expect(pathsByGroup()).toEqual({
      typography: 'typography',
      fontSize: 'font-size',
      spacing: 'spacing',
      sizing: 'sizing',
      radius: 'radius',
      border: 'border',
      shadow: 'shadow',
      ambient: 'ambient',
      motion: 'motion',
    });
  });

  it.each(TOKEN_GROUPS)('names %s as the account stores an override key', (group) => {
    expect(group).toMatch(TOKEN_GROUP_PATTERN);
  });

  it('fits an override for every group under the account cap', () => {
    expect(TOKEN_GROUPS.length).toBeLessThanOrEqual(MAX_APPEARANCE_OVERRIDES);
  });
});
