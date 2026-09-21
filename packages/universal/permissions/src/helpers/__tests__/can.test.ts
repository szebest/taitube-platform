import { describe, expect, it } from 'vitest';
import {
  adminUser,
  creatorUser,
  guestUser,
  publicVideo,
  sampleCategory,
  sampleChannel,
  sampleComment,
  standardUser,
} from '../../__mocks__/fixtures';
import { can } from '../can';

describe('helpers/can: Unified Action Evaluator Bridge', () => {
  it('evaluates video actions', () => {
    expect(can(guestUser, 'video:read', publicVideo)).toBe(true);
    expect(can(standardUser, 'video:create')).toBe(true);
    expect(can(standardUser, 'video:react')).toBe(true);
    expect(can(creatorUser, 'video:update', publicVideo)).toBe(true);
    expect(can(creatorUser, 'video:delete', publicVideo)).toBe(true);
    expect(can(creatorUser, 'video:publish', publicVideo)).toBe(true);
  });

  it('evaluates comment actions', () => {
    expect(can(standardUser, 'comment:create')).toBe(true);
    expect(can(standardUser, 'comment:delete', sampleComment)).toBe(true);
    expect(can(creatorUser, 'comment:pin', sampleComment)).toBe(true);
  });

  it('evaluates channel actions', () => {
    expect(can(standardUser, 'channel:update', sampleChannel)).toBe(true);
  });

  it('evaluates admin actions', () => {
    expect(can(standardUser, 'category:manage', sampleCategory)).toBe(false);
    expect(can(adminUser, 'category:manage', sampleCategory)).toBe(true);
    expect(can(adminUser, 'analytics:view_all')).toBe(true);
  });
});
