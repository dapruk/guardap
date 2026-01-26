import { describe, expect, it, vi } from 'vitest';
import { createGuard, type GuardConfig } from '../src';

type Roles = 'superAdmin' | 'admin' | 'staff' | 'intern';
type Features = 'settings' | 'users' | 'reports';
type Actions = 'view' | 'edit' | 'delete' | 'create';
type Conditions = 'active' | 'verified';
type Groups = 'management' | 'employees';

const config: GuardConfig<Roles, Features, Actions, Conditions, Groups> = {
  groups: {
    management: ['superAdmin', 'admin'],
    employees: ['staff', 'intern', 'admin'],
  },

  resolveAction: (action: Actions) =>
    ({
      view: 'r',
      edit: 'u',
      delete: 'd',
      create: 'c',
    })[action] || '?',

  getPermissions: (roles: Roles[]) => {
    if (roles.includes('superAdmin')) return { '*': '*' };
    if (roles.includes('admin'))
      return { settings: 'ru', users: 'crud', reports: 'r' };
    if (roles.includes('staff')) return { users: 'r', reports: 'c' };
    return {};
  },

  getUserState: (ctx?: any) => {
    if (ctx) return ctx;
    return {
      roles: ['staff'] as Roles[],
      conditions: { active: true },
    };
  },

  redirects: { login: '/auth/login', '403': '/forbidden' },
  defaultRedirect: '/403',
};

const Guard = createGuard(config);

describe('Guardap v1.0.0 Core Logic', () => {
  // --- ROLE CHECK ---
  describe('Role & Permission Checks', () => {
    it('should allow valid role', () => {
      const builder = Guard.with({ roles: ['admin'], conditions: {} });
      expect(builder.requireRole('admin').allowed()).toBe(true);
    });

    it('should allow valid role (Array OR logic)', () => {
      const builder = Guard.with({ roles: ['staff'], conditions: {} });
      expect(builder.requireRole(['admin', 'staff']).allowed()).toBe(true);
    });

    it('should block invalid role', () => {
      const builder = Guard.with({ roles: ['staff'], conditions: {} });
      expect(builder.requireRole('admin').allowed()).toBe(false);
    });

    it('should handle wildcard (God Mode)', () => {
      const builder = Guard.with({ roles: ['superAdmin'], conditions: {} });
      expect(builder.require('delete').on('settings').allowed()).toBe(true);
    });

    it('should validate permission codes correctly', () => {
      const builder = Guard.with({ roles: ['admin'], conditions: {} });
      // Admin settings = 'ru'
      expect(builder.require('view').on('settings').allowed()).toBe(true);
      expect(builder.require('edit').on('settings').allowed()).toBe(true);
      expect(builder.require('delete').on('settings').allowed()).toBe(false);
    });
  });

  // --- GROUP CHECK ---
  describe('Group Logic', () => {
    it('should allow member of a group', () => {
      const builder = Guard.with({ roles: ['admin'], conditions: {} });
      expect(builder.requireGroup('management').allowed()).toBe(true);
    });

    it('should block non-member', () => {
      const builder = Guard.with({ roles: ['staff'], conditions: {} });
      expect(builder.requireGroup('management').allowed()).toBe(false);
    });

    it('should support Multi-Group check (Array)', () => {
      const builder = Guard.with({ roles: ['intern'], conditions: {} });
      expect(builder.requireGroup(['management', 'employees']).allowed()).toBe(
        true,
      );
    });
  });

  // --- AUTHENTICATION CHECK ---
  describe('Authentication Logic', () => {
    it('should detect login via Role Fallback', () => {
      // FIX: Jangan reuse builder yg sama buat expect beda logic
      expect(
        Guard.with({ roles: ['staff'] })
          .requireLogin()
          .allowed(),
      ).toBe(true);
      expect(
        Guard.with({ roles: ['staff'] })
          .guestOnly()
          .allowed(),
      ).toBe(false);
    });

    it('should detect Guest via Role Fallback', () => {
      // FIX: Panggil Guard.with() baru setiap expect biar state bersih
      expect(Guard.with({ roles: [] }).requireLogin().allowed()).toBe(false);
      expect(Guard.with({ roles: [] }).guestOnly().allowed()).toBe(true);
    });

    it('should respect Explicit isAuthenticated flag', () => {
      const ctx = { roles: [], isAuthenticated: true };

      expect(Guard.with(ctx).requireLogin().allowed()).toBe(true);
      expect(Guard.with(ctx).guestOnly().allowed()).toBe(false);
    });
  });

  // --- LOGIC CHAINING (.OR) ---
  describe('Advanced Chaining (.or)', () => {
    it('should pass if FIRST condition is true', () => {
      const builder = Guard.with({ roles: ['admin'] });
      expect(
        builder.requireRole('admin').or().requireRole('staff').allowed(),
      ).toBe(true);
    });

    it('should pass if SECOND condition is true', () => {
      const builder = Guard.with({ roles: ['staff'] });
      expect(
        builder.requireRole('admin').or().requireRole('staff').allowed(),
      ).toBe(true);
    });

    it('should fail if BOTH conditions are false', () => {
      const builder = Guard.with({ roles: ['intern'] });
      expect(
        builder.requireRole('admin').or().requireRole('staff').allowed(),
      ).toBe(false);
    });

    it('should handle Complex Mixed Logic', () => {
      const builder = Guard.with({
        roles: ['staff'],
        conditions: { verified: false },
      });
      // False || (True && False) = False
      expect(
        builder
          .requireRole('admin')
          .or()
          .requireRole('staff')
          .mustBe('verified')
          .allowed(),
      ).toBe(false);
    });

    it('should handle Complex Mixed Logic (Success Case)', () => {
      const builder = Guard.with({
        roles: ['staff'],
        conditions: { verified: true },
      });
      // False || (True && True) = True
      expect(
        builder
          .requireRole('admin')
          .or()
          .requireRole('staff')
          .mustBe('verified')
          .allowed(),
      ).toBe(true);
    });
  });

  // --- ROUTER DRIVER ---
  describe('Router Driver', () => {
    it('should trigger redirect on failure', () => {
      const driverSpy = vi.fn();
      const GuardWithRouter = createGuard({
        ...config,
        router: { driver: driverSpy },
      });

      GuardWithRouter.with({ roles: ['staff'] })
        .requireRole('admin')
        .redirect('login');

      expect(driverSpy).toHaveBeenCalledWith('/auth/login');
    });

    it('should NOT trigger redirect on success', () => {
      const driverSpy = vi.fn();
      const GuardWithRouter = createGuard({
        ...config,
        router: { driver: driverSpy },
      });

      GuardWithRouter.with({ roles: ['admin'] })
        .requireRole('admin')
        .redirect();

      expect(driverSpy).not.toHaveBeenCalled();
    });
  });
});
