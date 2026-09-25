import { clearStoredValues } from './stored-value';

vi.mock(import('@uidotdev/usehooks'), async (importOriginal) => ({
  ...(await importOriginal()),
  useLocalStorage: (await import('./stored-value')).useStoredValue,
}));

beforeEach(() => {
  clearStoredValues();
});
