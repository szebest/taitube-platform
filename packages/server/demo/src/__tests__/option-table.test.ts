import { COMMANDS, DEFAULTS, FLAGS, PROFILE_DEFAULTS, helpText } from '../option-table';

describe('demo: option-table', () => {
  it('prints every flag and env var in the help', () => {
    const help = helpText();
    for (const flag of FLAGS) {
      expect(help).toContain(flag.flag);
      if (flag.env) expect(help).toContain(flag.env);
    }
  });

  it('prints every command and the defaults it was generated from', () => {
    const help = helpText();
    for (const command of COMMANDS) expect(help).toContain(command);
    expect(help).toContain(`default ${DEFAULTS.seed}`);
    expect(help).toContain(
      `${PROFILE_DEFAULTS.minimal.videos} minimal, ${PROFILE_DEFAULTS.full.videos} full`
    );
  });

  it('shows the env value of a boolean flag, not a flag value', () => {
    expect(helpText()).toContain('--no-worker ');
    expect(helpText()).toContain('env DEMO_WITH_WORKER=0|1');
  });
});
