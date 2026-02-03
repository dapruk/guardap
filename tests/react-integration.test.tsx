// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createGuard } from '../src/react';

type Roles = 'admin' | 'user';
type Features = 'settings';
type Actions = 'view';

const config = {
  groups: {},
  resolveAction: () => 'view',
  getPermissions: (roles: Roles[]) =>
    roles.includes('admin') ? { settings: 'view' } : {},
  getUserState: (ctx?: { role: Roles }) => ({
    roles: ctx?.role ? [ctx.role] : [],
    conditions: {},
  }),
};

describe('React Integration (Factory Pattern)', () => {
  afterEach(cleanup);

  it('should create bound components', () => {
    const { GuardProvider, AccessGuard } = createGuard<
      Roles,
      Features,
      Actions
    >(config);

    expect(GuardProvider).toBeDefined();
    expect(AccessGuard).toBeDefined();
  });

  it('should enforce access control using bound AccessGuard', async () => {
    const adminConfig = {
      ...config,
      getUserState: () => ({ roles: ['admin'] as Roles[], conditions: {} }),
    };

    const { GuardProvider, AccessGuard } = createGuard(adminConfig);

    render(
      <GuardProvider>
        <AccessGuard role="admin">
          <span>Restricted Content</span>
        </AccessGuard>
      </GuardProvider>,
    );

    expect(await screen.findByText('Restricted Content')).toBeTruthy();
  });

  it('should block access if role missing', async () => {
    const userConfig = {
      ...config,
      getUserState: () => ({ roles: ['user'] as Roles[], conditions: {} }),
    };

    const { GuardProvider, AccessGuard } = createGuard(userConfig);

    render(
      <GuardProvider>
        <AccessGuard role="admin" fallback={<span>Forbidden</span>}>
          <span>Restricted Content</span>
        </AccessGuard>
      </GuardProvider>,
    );

    expect(await screen.findByText('Forbidden')).toBeTruthy();
    expect(screen.queryByText('Restricted Content')).toBeNull();
  });

  it('should support withAuth HOC', async () => {
    const adminConfig = {
      ...config,
      getUserState: () => ({ roles: ['admin'] as Roles[], conditions: {} }),
    };

    const { GuardProvider, withAuth } = createGuard(adminConfig);

    const ProtectedComponent = withAuth(() => <span>Protected HOC</span>, {
      role: 'admin',
    });

    render(
      <GuardProvider>
        <ProtectedComponent />
      </GuardProvider>,
    );

    expect(await screen.findByText('Protected HOC')).toBeTruthy();
  });
});
