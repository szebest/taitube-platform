import { confirmationFinding, contextFinding, declaredContext, tagFinding } from '../guards';
import { COMPOSE, PREVIEW, PRODUCTION, STAGING } from './fixtures';

describe('declaredContext', () => {
  it.each([
    { env: PRODUCTION, expected: 'k3s-prod' },
    { env: COMPOSE, expected: 'vm' },
  ])('is $expected for $env.kind', ({ env, expected }) => {
    expect(declaredContext(env)).toBe(expected);
  });
});

describe('contextFinding', () => {
  it.each([
    { current: 'k3s-prod', expected: undefined },
    {
      current: 'k3d-vp',
      expected:
        'refusing production: the current context is k3d-vp, the environment declares k3s-prod',
    },
    { current: '', expected: 'no current context: production deploys to k3s-prod' },
    { current: undefined, expected: 'no current context: production deploys to k3s-prod' },
  ])('answers $expected for context "$current"', ({ current, expected }) => {
    expect(contextFinding(PRODUCTION, current)).toBe(expected);
  });
});

describe('confirmationFinding', () => {
  it.each([
    { env: PRODUCTION, confirmation: { yes: true, typed: undefined }, ok: false },
    { env: PRODUCTION, confirmation: { yes: true, typed: 'staging' }, ok: false },
    { env: PRODUCTION, confirmation: { yes: false, typed: 'production' }, ok: true },
    { env: STAGING, confirmation: { yes: true, typed: undefined }, ok: true },
    { env: STAGING, confirmation: { yes: false, typed: 'staging' }, ok: true },
    { env: STAGING, confirmation: { yes: false, typed: undefined }, ok: false },
    { env: PRODUCTION, confirmation: { yes: false, typed: 'staging' }, ok: false },
    { env: PRODUCTION, confirmation: { yes: false, typed: undefined }, ok: false },
    { env: PREVIEW, confirmation: { yes: false, typed: undefined }, ok: true },
  ])('for $env.name with $confirmation is ok: $ok', ({ env, confirmation, ok }) => {
    expect(confirmationFinding(env, confirmation) === undefined).toBe(ok);
  });

  it.each([
    {
      env: PRODUCTION,
      confirmation: { yes: true, typed: undefined },
      expected:
        'production is protected: type its name back with --confirm production (CONFIRM=production), --yes is not enough',
    },
    {
      env: STAGING,
      confirmation: { yes: false, typed: undefined },
      expected: 'staging is protected: pass --yes, or --confirm staging',
    },
  ])('tells the operator what to pass for $env.name', ({ env, confirmation, expected }) => {
    expect(confirmationFinding(env, confirmation)).toBe(expected);
  });
});

describe('tagFinding', () => {
  it.each([
    { env: PRODUCTION, tag: 'v1.2.3', ok: true },
    { env: PRODUCTION, tag: '{sha}', ok: true },
    { env: PRODUCTION, tag: 'latest', ok: false },
    { env: PRODUCTION, tag: undefined, ok: false },
    { env: PREVIEW, tag: 'latest', ok: true },
    { env: COMPOSE, tag: 'v1', ok: true },
  ])('for $env.name with tag $tag is ok: $ok', ({ env, tag, ok }) => {
    expect(tagFinding(env, tag) === undefined).toBe(ok);
  });

  it('tells the operator how to pin', () => {
    expect(tagFinding(PRODUCTION, 'latest')).toBe(
      'production is protected: pin an image tag, e.g. TAG=v1.2.3, not latest'
    );
  });
});
