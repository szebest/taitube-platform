import { renderHook } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { useSetName } from '../use-set-name';

const renderSetName = () =>
  renderHook(() => useSetName(), { wrapper: AppProviders }).result.current;

describe('useSetName', () => {
  it.each([
    { id: 'airy', name: 'Airy' },
    { id: 'xlarge', name: 'Xlarge' },
    { id: 'Soft', name: 'Soft' },
    { id: '', name: '' },
  ])('reads $id as $name', ({ id, name }) => {
    expect(renderSetName()(id)).toBe(name);
  });
});
