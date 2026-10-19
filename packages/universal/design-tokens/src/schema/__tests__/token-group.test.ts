import { tokenGroups } from '../token-group';

const pathsByGroup = () =>
  Object.fromEntries(Object.entries(tokenGroups).map(([group, { path }]) => [group, path]));

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
});
