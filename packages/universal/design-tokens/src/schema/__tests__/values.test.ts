import type { ZodType } from 'zod';
import {
  CubicBezierSchema,
  DimensionSchema,
  DurationSchema,
  FontFamilySchema,
  FontWeightSchema,
  LineHeightSchema,
  OpacitySchema,
  ShadowLayersSchema,
} from '../values';

const layer = { color: '#00000066', offsetX: '0px', offsetY: '8px', blur: '24px', spread: '-8px' };

const accepts = (schema: ZodType, value: unknown) => schema.safeParse(value).success;

describe('token values', () => {
  it.each([
    { label: 'a pixel dimension', schema: DimensionSchema, value: '1.5px' },
    { label: 'a negative em dimension', schema: DimensionSchema, value: '-0.035em' },
    { label: 'a duration in milliseconds', schema: DurationSchema, value: '560ms' },
    {
      label: 'a six digit shadow colour',
      schema: ShadowLayersSchema,
      value: [{ ...layer, color: '#2A1E10' }],
    },
    {
      label: 'an eight digit shadow colour',
      schema: ShadowLayersSchema,
      value: [{ ...layer, color: '#2a1e100f' }],
    },
    { label: 'a font stack', schema: FontFamilySchema, value: ['Figtree Variable', 'sans-serif'] },
    { label: 'a variable font weight', schema: FontWeightSchema, value: 650 },
    { label: 'a unitless line height', schema: LineHeightSchema, value: 1.35 },
    { label: 'a full opacity', schema: OpacitySchema, value: 1 },
    { label: 'an overshooting easing', schema: CubicBezierSchema, value: [0.2, 1.4, 0.2, -0.3] },
    {
      label: 'a layered shadow',
      schema: ShadowLayersSchema,
      value: [layer, { ...layer, blur: '2px' }],
    },
  ])('accepts $label', ({ schema, value }) => {
    expect(accepts(schema, value)).toBe(true);
  });

  it.each([
    { label: 'a dimension without a unit', schema: DimensionSchema, value: '12' },
    { label: 'a dimension as a number', schema: DimensionSchema, value: 12 },
    { label: 'a dimension in rem', schema: DimensionSchema, value: '1rem' },
    { label: 'a duration in seconds', schema: DurationSchema, value: '0.5s' },
    { label: 'a negative duration', schema: DurationSchema, value: '-80ms' },
    {
      label: 'a three digit shadow colour',
      schema: ShadowLayersSchema,
      value: [{ ...layer, color: '#fff' }],
    },
    {
      label: 'a shadow colour without its hash',
      schema: ShadowLayersSchema,
      value: [{ ...layer, color: '2A1E10' }],
    },
    { label: 'an empty font stack', schema: FontFamilySchema, value: [] },
    { label: 'an empty family name', schema: FontFamilySchema, value: [''] },
    { label: 'a fractional font weight', schema: FontWeightSchema, value: 400.5 },
    { label: 'a font weight over 1000', schema: FontWeightSchema, value: 1001 },
    { label: 'a zero line height', schema: LineHeightSchema, value: 0 },
    { label: 'an opacity over 1', schema: OpacitySchema, value: 1.1 },
    { label: 'an easing x outside 0 to 1', schema: CubicBezierSchema, value: [1.2, 0, 0, 1] },
    { label: 'an easing with three points', schema: CubicBezierSchema, value: [0.2, 0, 0] },
    { label: 'a shadow with no layer', schema: ShadowLayersSchema, value: [] },
    {
      label: 'a shadow layer missing its spread',
      schema: ShadowLayersSchema,
      value: [{ ...layer, spread: undefined }],
    },
    {
      label: 'a shadow layer with an inset flag',
      schema: ShadowLayersSchema,
      value: [{ ...layer, inset: true }],
    },
  ])('rejects $label', ({ schema, value }) => {
    expect(accepts(schema, value)).toBe(false);
  });
});
