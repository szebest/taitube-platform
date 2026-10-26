import { camel, pascal } from './scaffold';

export const COMPONENT_KINDS = ['primitive', 'shared', 'web', 'studio'] as const;

export type ComponentKind = (typeof COMPONENT_KINDS)[number];

const KIND_HOME: Readonly<Record<ComponentKind, string>> = {
  primitive: 'packages/client/ui/src/primitives',
  shared: 'packages/client/components/src',
  web: 'apps/client/web/src/components',
  studio: 'apps/client/studio/src/components',
};

const STORY_SHELF: Readonly<Record<ComponentKind, string>> = {
  primitive: 'Primitives',
  shared: 'Components',
  web: 'Web',
  studio: 'Studio',
};

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export const isKebab = (name: string) => KEBAB.test(name);

export type ComponentRequest = Readonly<{
  name: string;
  kind: ComponentKind;
  area: string | undefined;
  compound: boolean;
}>;

export const componentHome = (kind: ComponentKind) => KIND_HOME[kind];

/** The folder a component of `kind` lives in, relative to the repo root; a primitive has no area. */
export function componentFolder({ name, kind, area }: ComponentRequest): string {
  const areaFolder = area === undefined || kind === 'primitive' ? [] : [area];
  return [componentHome(kind), ...areaFolder, name].join('/');
}

/** Inside `@vp/ui` a primitive reaches the helpers through its own `lib/`; everything else imports `@vp/ui`. */
function helperModules(kind: ComponentKind) {
  return kind === 'primitive'
    ? {
        classNames: '../../lib/class-names',
        context: '../../lib/create-compound-context',
        types: '../../types',
        variantNames: '../../lib/variant-names',
      }
    : { classNames: '@vp/ui', context: '@vp/ui', types: '@vp/ui', variantNames: '@vp/ui' };
}

type Names = Readonly<{ name: string; Name: string; styles: string; shelf: string }>;

const typesFile = ({ Name }: Names, from: string) => `import type { FillOption } from '${from}';

export type ${Name}Fill = Extract<FillOption, 'soft' | 'ghost'>;
`;

const storyFile = (
  { name, styles, shelf }: Names,
  { parts, component, render }: Readonly<{ parts: string; component: string; render: string }>,
  variantNamesFrom: string
) => `import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '${variantNamesFrom}';
import { ${parts} } from './${name}';
import { ${styles} } from './${name}.variants';

const meta = {
  title: '${shelf}',
  component: ${component},
} satisfies Meta<typeof ${component}>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EveryFill: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-stack">
      {variantNames(${styles}.variants.variant).map((variant) => (
${render}
      ))}
    </div>
  ),
};
`;

const specFile = (
  { name, Name, styles }: Names,
  { parts, props, subject }: Readonly<{ parts: string; props: string; subject: string }>,
  variantNamesFrom: string
) => `import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { variantNames } from '${variantNamesFrom}';
import { ${parts}, type ${props} } from '../${name}';
import { ${styles} } from '../${name}.variants';

const render${Name} = (props: Partial<${props}> = {}) =>
  render(
${subject}
  );

describe('${Name}', () => {
  it.each(variantNames(${styles}.variants.variant))('shows its content in the %s fill', (variant) => {
    render${Name}({ variant });

    expect(screen.getByText('${Name}')).toBeInTheDocument();
  });

  it('passes axe', async () => {
    render${Name}();

    expect(await axeViolations()).toEqual([]);
  });
});
`;

function singleFiles(names: Names, from: ReturnType<typeof helperModules>) {
  const { name, Name, styles } = names;
  return {
    'types.ts': typesFile(names, from.types),
    [`${name}.variants.ts`]: `import { tv } from '${from.classNames}';
import type { ${Name}Fill } from './types';

export const ${styles} = tv({
  base: 'tw:flex tw:gap-inline tw:rounded-card tw:p-inset-card tw:text-fg',
  variants: {
    variant: {
      soft: 'tw:bg-tint',
      ghost: 'tw:bg-transparent',
    } satisfies Record<${Name}Fill, string>,
  },
  defaultVariants: { variant: 'soft' },
});
`,
    [`${name}.tsx`]: `import type { ComponentPropsWithRef } from 'react';
import { ${styles} } from './${name}.variants';
import type { ${Name}Fill } from './types';

export interface ${Name}Props extends ComponentPropsWithRef<'div'> {
  variant?: ${Name}Fill;
}

export function ${Name}({ variant, className, ...props }: ${Name}Props) {
  return <div data-slot="${name}" className={${styles}({ variant, className })} {...props} />;
}
`,
    [`${name}.stories.tsx`]: storyFile(
      names,
      {
        parts: Name,
        component: Name,
        render: `        <${Name} key={variant} {...args} variant={variant}>
          {variant}
        </${Name}>`,
      },
      from.variantNames
    ),
    [`__tests__/${name}.dom.test.tsx`]: specFile(
      names,
      { parts: Name, props: `${Name}Props`, subject: `    <${Name} {...props}>${Name}</${Name}>` },
      from.variantNames
    ),
    'index.ts': `export type { ${Name}Props } from './${name}';
export { ${Name} } from './${name}';
export { ${styles} } from './${name}.variants';
export type { ${Name}Fill } from './types';
`,
  };
}

function compoundFiles(names: Names, from: ReturnType<typeof helperModules>) {
  const { name, Name, styles } = names;
  const parts = `${Name}Item, ${Name}Root`;
  return {
    'types.ts': typesFile(names, from.types),
    [`${name}.context.ts`]: `import { createCompoundContext } from '${from.context}';
import type { ${Name}Fill } from './types';

export const [${Name}Context, use${Name}] = createCompoundContext<{ variant: ${Name}Fill }>(
  '${Name}'
);
`,
    [`${name}.variants.ts`]: `import { tv } from '${from.classNames}';
import type { ${Name}Fill } from './types';

export const ${styles} = tv({
  slots: {
    root: 'tw:flex tw:gap-inline tw:rounded-card tw:p-inset-card tw:text-fg',
    item: 'tw:rounded-control tw:px-inset-control',
  },
  variants: {
    variant: {
      soft: { root: 'tw:bg-tint', item: 'tw:bg-surface' },
      ghost: { root: 'tw:bg-transparent', item: 'tw:bg-tint' },
    } satisfies Record<${Name}Fill, object>,
  },
  defaultVariants: { variant: 'soft' },
});
`,
    [`${name}.tsx`]: `import { type ComponentPropsWithRef, useMemo } from 'react';
import { ${Name}Context, use${Name} } from './${name}.context';
import { ${styles} } from './${name}.variants';
import type { ${Name}Fill } from './types';

export interface ${Name}RootProps extends ComponentPropsWithRef<'div'> {
  variant?: ${Name}Fill;
}

export function ${Name}Root({ variant = 'soft', className, ...props }: ${Name}RootProps) {
  const shared = useMemo(() => ({ variant }), [variant]);

  return (
    <${Name}Context value={shared}>
      <div data-slot="${name}" className={${styles}({ variant }).root({ className })} {...props} />
    </${Name}Context>
  );
}

export type ${Name}ItemProps = ComponentPropsWithRef<'div'>;

export function ${Name}Item({ className, ...props }: ${Name}ItemProps) {
  const { variant } = use${Name}('Item');

  return (
    <div data-slot="${name}-item" className={${styles}({ variant }).item({ className })} {...props} />
  );
}
`,
    [`${name}.stories.tsx`]: storyFile(
      names,
      {
        parts,
        component: `${Name}Root`,
        render: `        <${Name}Root key={variant} {...args} variant={variant}>
          <${Name}Item>{variant}</${Name}Item>
        </${Name}Root>`,
      },
      from.variantNames
    ),
    [`__tests__/${name}.dom.test.tsx`]: specFile(
      names,
      {
        parts,
        props: `${Name}RootProps`,
        subject: `    <${Name}Root {...props}>
      <${Name}Item>${Name}</${Name}Item>
    </${Name}Root>`,
      },
      from.variantNames
    ),
    'index.ts': `import { ${parts} } from './${name}';

export const ${Name} = { Root: ${Name}Root, Item: ${Name}Item };
export type { ${Name}ItemProps, ${Name}RootProps } from './${name}';
export { use${Name} } from './${name}.context';
export { ${styles} } from './${name}.variants';
export type { ${Name}Fill } from './types';
`,
  };
}

/** Every file of the folder by its path inside it: the component, styles, types, story, spec and index. */
export function componentFiles(request: ComponentRequest): Readonly<Record<string, string>> {
  const { name, kind, compound } = request;
  const names = {
    name,
    Name: pascal(name),
    styles: `${camel(name)}Styles`,
    shelf: `${STORY_SHELF[kind]}/${pascal(name)}`,
  };
  const from = helperModules(kind);
  return compound ? compoundFiles(names, from) : singleFiles(names, from);
}
