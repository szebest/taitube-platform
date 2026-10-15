import { axeViolations } from '../axe';

describe('@vp/web-testing: axeViolations', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it.each([
    { page: 'a button with no name', markup: '<button></button>', violations: ['button-name'] },
    { page: 'a labelled button', markup: '<button>Save</button>', violations: [] },
  ])('reports the rules $page breaks', async ({ markup, violations }) => {
    document.body.innerHTML = markup;

    expect(await axeViolations()).toEqual(violations);
  });
});
