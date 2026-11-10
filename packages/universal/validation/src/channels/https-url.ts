export function isHttpsUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const { protocol, username, password } = new URL(value);
  return protocol === 'https:' && username === '' && password === '';
}
