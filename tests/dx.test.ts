import { describe, expect, it, vi } from 'vitest';
import { createGuard } from '../src';

type Roles = 'admin' | 'user';
type Features = 'products';
type Actions = 'create';

describe('DX Improvements', () => {
  describe('Debug Mode', () => {
    const config = {
      debug: true,
      getUserState: () => ({ roles: ['user'] as Roles[], conditions: {} }),
      getPermissions: () => ({}),
    };

    const guard = createGuard<Roles, Features, Actions>(config);

    it('should log warning when permission denied', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      guard.requireRole('admin').allowed();

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('[Guardap] Rejected: Missing role'),
        expect.any(Object),
      );

      spy.mockRestore();
    });

    it('should log warning when component logic fails', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      guard.require('create').on('products').allowed();

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[Guardap] Rejected: No permissions for feature',
        ),
        '',
      );

      spy.mockRestore();
    });
  });

  describe('Sync Hydration', () => {
    it('should return result synchronously when getUserState is synchronous', () => {
      const config = {
        getUserState: () => ({ roles: ['admin'] as Roles[], conditions: {} }),
        getPermissions: () => ({}),
      };

      const guard = createGuard<Roles, Features, Actions>(config);

      const result = guard.requireRole('admin').allowed();

      expect(result).toBe(true);
    });

    it('should not be a promise', () => {
      const config = {
        getUserState: () => ({ roles: ['admin'] as Roles[], conditions: {} }),
        getPermissions: () => ({}),
      };

      const guard = createGuard<Roles, Features, Actions>(config);
      const chain = guard.requireRole('admin');

      // Check private proeprty via casting if necessary or inferred behavior
      // Since .allowed() throws if it was async, simpler check:
      expect(() => chain.allowed()).not.toThrow();
    });
  });
});
