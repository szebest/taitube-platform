import { readBrowserEnvironment } from '../browser-environment';

describe('@vp/intl-react: readBrowserEnvironment', () => {
  it("reads the runtime's zone and the time", () => {
    const environment = readBrowserEnvironment();

    expect(environment.timeZone).not.toBe('');
    expect(Number.isNaN(Date.parse(environment.now))).toBe(false);
  });
});
