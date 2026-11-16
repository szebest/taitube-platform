import type { ArgumentFreeKey, DisjointNamespaces } from '../../catalogue';
import { catalogues, engine, i18n, intlFor, type source } from '../fixtures';

const { dt, defineCatalogue } = engine;
const polish = defineCatalogue<typeof source>();

polish({
  videos: {
    views: dt('{count:plural}', {
      plural: {
        count: { one: '{?} film', few: '{?} filmy', many: '{?} filmów', other: '{?} filmu' },
      },
    }),
  },
});

polish({
  // @ts-expect-error a renamed param: {count} became {price}
  videos: { views: dt('{price:plural}', { plural: { price: { other: '{?}' } } }) },
});

// @ts-expect-error a dropped param
polish({ videos: { categories: dt('In some') } });

// @ts-expect-error a retyped param: a list became a date
polish({ videos: { categories: dt('In {names:date}') } });

// @ts-expect-error an added param
polish({ videos: { categories: dt('{name} in {names:list}') } });

// @ts-expect-error an enum with other labels takes other arguments
polish({ videos: { state: dt('{state:enum}', { enum: { state: { done: 'Gotowe' } } }) } });

// @ts-expect-error a namespace the source does not have
polish({ watch: {} });

const { t, tOr } = i18n.createTranslator(intlFor('en'), catalogues);

t('videos.views', { count: 5 });
t('videos.state', { state: 'ready' });
t('errors.forbidden');
tOr('videos.categories', { names: ['a'] }, '');

// @ts-expect-error a misspelt argument name
t('videos.views', { conut: 5 });

// @ts-expect-error an argument of the wrong type
t('videos.views', { count: '5' });

// @ts-expect-error an enum member the config does not label
t('videos.state', { state: 'gone' });

// @ts-expect-error a message with placeholders needs its arguments
t('videos.categories');

// @ts-expect-error a key the registered catalogue does not hold
t('videos.gone');

expectTypeOf<ArgumentFreeKey<typeof source>>().toEqualTypeOf<'errors.forbidden'>();

const web = { watch: { title: dt('Watch') } };
const shared = { errors: { forbidden: dt('Not allowed.') } };

expectTypeOf<DisjointNamespaces<[typeof web, typeof shared]>>().toEqualTypeOf<{
  watch: typeof web.watch;
  errors: typeof shared.errors;
}>();
engine.createI18n<DisjointNamespaces<[typeof web, typeof shared]>>();

// @ts-expect-error NamespaceCollision: two catalogues of one app share a namespace
engine.createI18n<DisjointNamespaces<[typeof shared, typeof source]>>();
