import { describe, expect, it } from 'vitest';
import { createGuard, defineGuardRedirects, type GuardConfig } from '../src';
import { createReactRouterDriver } from '../src/drivers/react-router';

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
});
