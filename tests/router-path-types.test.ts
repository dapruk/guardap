import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { createGuard, defineGuardRedirects, type GuardConfig } from '../src';
import {
  createReactRouterDriver,
  defineReactRouterRoutes,
} from '../src/drivers/react-router';
import { createTanStackRouterDriver } from '../src/drivers/tanstack';

type Roles = 'admin';
type Features = 'posts';
type Actions = 'read';
type Conditions = 'active';
type Groups = 'staff';
type AppRoutePath = '/' | '/login' | '/posts';

describe('typed redirect paths', () => {
  it('accepts valid route paths', () => {
    const config: GuardConfig<
      Roles,
      Features,
      Actions,
      Conditions,
      Groups,
      any,
      AppRoutePath
    > = {
      defaultRedirect: '/login',
      redirects: defineGuardRedirects<AppRoutePath>()({
        '/': '/posts',
      }),
      router: {
        driver: createReactRouterDriver<AppRoutePath>(() => {}),
      },
      getPermissions: () => ({ posts: 'r' }),
      getUserState: () => ({ roles: [], conditions: {} }),
    };

    const Guard = createGuard<
      Roles,
      Features,
      Actions,
      Conditions,
      Groups,
      any,
      AppRoutePath
    >(config);

    Guard.requireLogin().redirect('/login');

    expect(config.defaultRedirect).toBe('/login');
  });

  it('documents invalid route path expectations for TypeScript', () => {
    const config = {
      // @ts-expect-error - defaultRedirect must be an AppRoutePath.
      defaultRedirect: '/wrong-path',
      redirects: defineGuardRedirects<AppRoutePath>()({
        '/': '/login',
        // @ts-expect-error - redirects values must be AppRoutePath.
        '/login': '/wrong-path',
      }),
      router: {
        driver: createReactRouterDriver<AppRoutePath>(() => {}),
      },
      getPermissions: () => ({ posts: 'r' }),
      getUserState: () => ({ roles: [], conditions: {} }),
    } satisfies GuardConfig<
      Roles,
      Features,
      Actions,
      Conditions,
      Groups,
      any,
      AppRoutePath
    >;

    defineGuardRedirects<AppRoutePath>()({
      // @ts-expect-error - redirects keys must be AppRoutePath.
      '/wrong-path': '/login',
    });

    const Guard = createGuard<
      Roles,
      Features,
      Actions,
      Conditions,
      Groups,
      any,
      AppRoutePath
    >({
      ...config,
      defaultRedirect: '/login',
      redirects: { '/': '/posts' },
    });

    // @ts-expect-error - redirect only accepts AppRoutePath.
    Guard.requireLogin().redirect('/wrong-path');

    expect(true).toBe(true);
  });

  it('infers redirect paths from React Router route objects', () => {
    const routes = defineReactRouterRoutes([
      {
        path: '/',
        children: [
          { index: true },
          { path: 'login' },
          { path: 'posts/:postId' },
        ],
      },
      { path: '/settings' },
    ] as const);

    const Guard = createGuard({
      defaultRedirect: '/login',
      router: {
        driver: createReactRouterDriver(() => {}, routes),
      },
      getPermissions: (_roles: Roles[]) => ({ posts: 'r' }),
      getUserState: () => ({ roles: [] as Roles[], conditions: {} }),
    });

    Guard.requireLogin().redirect('/posts/:postId');
    Guard.requireLogin().redirect('/settings');

    // @ts-expect-error - redirect paths are inferred from the route objects.
    Guard.requireLogin().redirect('/wrong-path');

    expect(routes[0].children[2].path).toBe('posts/:postId');
  });

  it('infers redirect paths from a TanStack router', () => {
    const rootRoute = createRootRoute();
    const loginRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/login',
    });
    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    });
    const routeTree = rootRoute.addChildren([loginRoute, postsRoute]);
    const router = createRouter({ routeTree });

    const Guard = createGuard({
      defaultRedirect: '/login',
      router: {
        driver: createTanStackRouterDriver(router),
      },
      getPermissions: (_roles: Roles[]) => ({ posts: 'r' }),
      getUserState: () => ({ roles: [] as Roles[], conditions: {} }),
    });

    expect(() => Guard.requireLogin().redirect('/posts')).toThrow();

    if (false) {
      // @ts-expect-error - redirect paths are inferred from the TanStack route tree.
      Guard.requireLogin().redirect('/wrong-path');
    }

    expect(router.routeTree).toBe(routeTree);
  });
});
