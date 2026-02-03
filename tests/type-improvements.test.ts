import { describe, expect, it } from 'vitest';
import { createGuard, GuardConfig } from '../src';

type Roles = 'admin' | 'user';
type Features = 'dashboard';
type Actions = 'view';
type Conditions = 'active';
type Groups = 'admins';

describe('Type System Improvements', () => {
  const config: GuardConfig<
    Roles,
    Features,
    Actions,
    Conditions,
    Groups,
    { vip: boolean }
  > = {
    groups: {
      admins: ['admin'],
    },
    resolveAction: () => 'view',
    getPermissions: () => ({ dashboard: 'view' }),
    getUserState: (ctx) => {
      if (ctx) return ctx;
      return {
        roles: ['user'],
        conditions: {},
        vip: true, // Custom Data
      };
    },
  };

  const Guard = createGuard(config);

  it('should accept Readonly Arrays (as const)', () => {
    const roles = ['admin', 'user'] as const;
    const builder = Guard.with({
      roles: ['admin'],
      conditions: {},
      vip: false,
    });

    expect(builder.requireRole(roles).allowed()).toBe(true);
  });

  it('should support Method Overloading (Single vs Array)', () => {
    const builder = Guard.with({
      roles: ['admin'],
      conditions: {},
      vip: false,
    });

    expect(builder.requireRole('admin').allowed()).toBe(true);

    expect(builder.requireRole(['admin']).allowed()).toBe(true);
  });

  it('should infer custom Context Data (TData)', async () => {
    const builder = Guard.with({ roles: ['user'], conditions: {}, vip: true });

    expect(builder.allowed()).toBe(true);
  });
});
