import { describe, expect, it } from 'vitest';
import { createGuard, type GuardConfig } from '../src';

type Roles = 'superAdmin' | 'admin' | 'staff';
type Features = 'settings' | 'users';
type Actions = 'view' | 'edit' | 'delete' | 'create';
type Conditions = 'active';
type Groups = 'management';

const syncConfig: GuardConfig<Roles, Features, Actions, Conditions, Groups> = {
  getPermissions: (roles) => {
    if (roles.includes('superAdmin')) return { '*': '*' };
    if (roles.includes('admin')) return { settings: '*' }; // Feature-level wildcard
    return { users: 'r' };
  },
  getUserState: () => ({
    roles: ['admin'],
    conditions: { active: true },
  }),
  resolveAction: (action) => action[0], // Simple resolver
};

const asyncConfig: GuardConfig<Roles, Features, Actions, Conditions, Groups> = {
  ...syncConfig,
  getUserState: async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return {
      roles: ['admin'],
      conditions: { active: true },
    };
  },
};

describe('Guardap v1.1.0 New Features', () => {
  describe('Feature-Level Wildcards', () => {
    const Guard = createGuard(syncConfig);

    it('should allow ALL actions on a wildcard feature', () => {
      const builder = Guard.with({ roles: ['admin'] });
      // Admin has settings: '*'
      expect(builder.require('view').on('settings').allowed()).toBe(true);
      expect(builder.require('edit').on('settings').allowed()).toBe(true);
      expect(builder.require('delete').on('settings').allowed()).toBe(true);
      expect(builder.require('create').on('settings').allowed()).toBe(true);
    });

    it('should NOT allow actions on other features', () => {
      const builder = Guard.with({ roles: ['admin'] });
      // Admin does NOT have users: '*' (only settings: '*')
      // Actually config says: if admin, return { settings: '*' }.
      // So users is undefined.
      expect(builder.require('view').on('users').allowed()).toBe(false);
    });
  });

  describe('Async Logic Support', () => {
    const AsyncGuard = createGuard(asyncConfig);

    it('should throw if calling .allowed() on async guard', () => {
      const builder = AsyncGuard.with(undefined); // Uses async getUserState
      expect(() => builder.allowed()).toThrow(
        '[Guardap] Cannot call .allowed() on an async Guard',
      );
    });

    it('should resolve permissions correctly with .allowedAsync()', async () => {
      const builder = AsyncGuard.with(undefined);
      const result = await builder.requireRole('admin').allowedAsync();
      expect(result).toBe(true);
    });

    it('should handle chaining in async mode', async () => {
      const builder = AsyncGuard.with(undefined);
      const result = await builder
        .requireRole('admin')
        .require('view')
        .on('settings')
        .allowedAsync();
      expect(result).toBe(true);
    });

    it('should handle .or() logic in async mode', async () => {
      const builder = AsyncGuard.with(undefined);
      // Admin is present, so first part passes.
      const result = await builder
        .requireRole('staff') // Fail
        .or()
        .requireRole('admin') // Pass
        .allowedAsync();
      expect(result).toBe(true);
    });
  });

  describe('Type Safety', () => {
    it('should infer types correctly (Compile-time check)', () => {
      // This is mostly for the compiler, but we can check runtime behavior
      const Guard = createGuard(syncConfig);
      expect(Guard.with({ roles: ['staff'] }).allowed()).toBe(true);
    });
  });
});
