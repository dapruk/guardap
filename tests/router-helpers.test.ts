import { describe, expect, it, vi } from 'vitest';
import {
  applyGuardMeta,
  createGuard,
  evaluateGuardMeta,
  type GuardConfig,
  type GuardapRouteMeta,
} from '../src';
import {
  createReactRouterDriver,
  defineReactRouterPaths,
  type ReactRouterGuardHandle,
} from '../src/drivers/react-router';
import {
  defineTanStackRouterPaths,
  type TanStackGuardStaticData,
} from '../src/drivers/tanstack';

vi.mock('@tanstack/react-router', () => ({
  redirect: (options: unknown) => ({ type: 'redirect', options }),
}));

type Roles = 'admin' | 'editor' | 'guest';
type Features = 'posts' | 'settings';
type Actions = 'read' | 'edit';
type Conditions = 'active' | 'verified';
type Groups = 'staff';
type AppRoutePath = '/' | '/login' | '/posts' | '/settings';

const config: GuardConfig<Roles, Features, Actions, Conditions, Groups> = {
  groups: {
    staff: ['admin', 'editor'],
  },
  getPermissions: (roles) => {
    if (roles.includes('admin')) return { '*': '*' };
    if (roles.includes('editor')) return { posts: 'r' };
    return {};
  },
  getUserState: (ctx?: {
    roles: Roles[];
    conditions?: Partial<Record<Conditions, boolean>>;
  }) => ({
    roles: ctx?.roles ?? [],
    conditions: ctx?.conditions ?? {},
  }),
};

const Guard = createGuard(config);

describe('router guard metadata helpers', () => {
  it('accepts typed React Router handle metadata', () => {
    const route = {
      path: '/posts',
      handle: {
        guard: {
          login: true,
          role: ['admin', 'editor'],
          group: 'staff',
          condition: 'active',
          feature: 'posts',
          action: 'read',
          redirectTo: '/login',
        },
      } satisfies ReactRouterGuardHandle<
        Roles,
        Features,
        Actions,
        Conditions,
        Groups
      >,
    };

    expect(route.handle.guard.feature).toBe('posts');
  });

  it('accepts typed TanStack staticData metadata', () => {
    const staticData = {
      guard: {
        login: true,
        role: 'admin',
        group: ['staff'],
        condition: 'verified',
        feature: 'settings',
        action: 'edit',
      },
    } satisfies TanStackGuardStaticData<
      Roles,
      Features,
      Actions,
      Conditions,
      Groups
    >;

    expect(staticData.guard.action).toBe('edit');
  });

  it('types redirect paths across config, chains, and drivers', () => {
    const typedConfig: GuardConfig<
      Roles,
      Features,
      Actions,
      Conditions,
      Groups,
      any,
      AppRoutePath
    > = {
      ...config,
      defaultRedirect: '/login',
      redirects: {
        '/': '/posts',
        '/settings': '/login',
      },
      router: {
        driver: createReactRouterDriver<AppRoutePath>(vi.fn() as any),
      },
    };

    const TypedGuard = createGuard<
      Roles,
      Features,
      Actions,
      Conditions,
      Groups,
      any,
      AppRoutePath
    >(typedConfig);

    TypedGuard.with({ roles: [] }).requireLogin().redirect('/login');

    const route = {
      handle: {
        guard: {
          login: true,
          redirectTo: '/login',
        },
      } satisfies ReactRouterGuardHandle<
        Roles,
        Features,
        Actions,
        Conditions,
        Groups,
        AppRoutePath
      >,
    };

    expect(route.handle.guard.redirectTo).toBe('/login');
  });

  it('defines router path unions from path arrays', () => {
    const reactPaths = defineReactRouterPaths([
      '/',
      '/login',
      '/posts',
    ] as const);
    const tanstackPaths = defineTanStackRouterPaths([
      '/',
      '/login',
      '/settings',
    ] as const);

    expect(reactPaths).toContain('/posts');
    expect(tanstackPaths).toContain('/settings');
  });

  it('exports the shared GuardapRouteMeta type', () => {
    const meta: GuardapRouteMeta<Roles, Features, Actions, Conditions, Groups> =
      {
        role: 'editor',
        feature: 'posts',
        action: 'read',
      };

    expect(meta.role).toBe('editor');
  });

  it('evaluates login metadata', () => {
    expect(
      evaluateGuardMeta(Guard, { login: true }, { roles: ['admin'] }),
    ).toBe(true);
    expect(evaluateGuardMeta(Guard, { login: true }, { roles: [] })).toBe(
      false,
    );
  });

  it('evaluates role metadata', () => {
    expect(
      evaluateGuardMeta(Guard, { role: 'editor' }, { roles: ['editor'] }),
    ).toBe(true);
    expect(
      evaluateGuardMeta(Guard, { role: 'admin' }, { roles: ['editor'] }),
    ).toBe(false);
  });

  it('evaluates group metadata', () => {
    expect(
      evaluateGuardMeta(Guard, { group: 'staff' }, { roles: ['editor'] }),
    ).toBe(true);
    expect(
      evaluateGuardMeta(Guard, { group: 'staff' }, { roles: ['guest'] }),
    ).toBe(false);
  });

  it('evaluates condition metadata', () => {
    expect(
      evaluateGuardMeta(
        Guard,
        { condition: 'active' },
        { roles: ['editor'], conditions: { active: true } },
      ),
    ).toBe(true);
    expect(
      evaluateGuardMeta(
        Guard,
        { condition: 'active' },
        { roles: ['editor'], conditions: { active: false } },
      ),
    ).toBe(false);
  });

  it('evaluates feature and action metadata', () => {
    expect(
      evaluateGuardMeta(
        Guard,
        { feature: 'posts', action: 'read' },
        { roles: ['editor'] },
      ),
    ).toBe(true);
    expect(
      evaluateGuardMeta(
        Guard,
        { feature: 'settings', action: 'edit' },
        { roles: ['editor'] },
      ),
    ).toBe(false);
  });

  it('returns a chain from applyGuardMeta', () => {
    const chain = applyGuardMeta(
      Guard,
      { role: 'editor', feature: 'posts', action: 'read' },
      { roles: ['editor'] },
    );

    expect(chain.allowed()).toBe(true);
  });

  it('supports async getUserState in evaluateGuardMeta', async () => {
    const AsyncGuard = createGuard({
      ...config,
      getUserState: async () => ({
        roles: ['editor'] as Roles[],
        conditions: { active: true },
      }),
    });

    await expect(
      evaluateGuardMeta(AsyncGuard, {
        role: 'editor',
        feature: 'posts',
        action: 'read',
      }),
    ).resolves.toBe(true);
  });

  it('keeps the React Router driver export working', () => {
    const navigate = vi.fn();
    const driver = createReactRouterDriver(navigate as any);

    driver('/login');

    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('keeps the TanStack driver export working', async () => {
    const { TanStackDriver } = await import('../src/drivers/tanstack');

    try {
      TanStackDriver('/login');
      throw new Error('Expected TanStackDriver to throw');
    } catch (error) {
      expect(error).toEqual({
        type: 'redirect',
        options: { to: '/login' },
      });
    }
  });
});
