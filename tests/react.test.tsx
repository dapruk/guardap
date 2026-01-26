// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createGuard, type GuardConfig } from '../src';
import { createReactAccessGuard } from '../src/react';

type Roles = 'admin' | 'user';
type Features = 'dashboard';
type Actions = 'view';

const asyncConfig: GuardConfig<Roles, Features, Actions, any, any> = {
  getPermissions: () => ({ dashboard: 'r' }),
  getUserState: async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { roles: ['admin'], conditions: {} };
  },
  resolveAction: (a) => a[0],
};

const Guard = createGuard(asyncConfig);
const { AccessGuard, AccessGuardProvider } = createReactAccessGuard(Guard);

describe('React AccessGuard Async Support', () => {
  it('should show loading state then content', async () => {
    render(
      <AccessGuardProvider>
        <AccessGuard
          role="admin"
          fallback={<div>Forbidden</div>}
          loadingComponent={<div>Loading...</div>}
        >
          <div>Protected Content</div>
        </AccessGuard>
      </AccessGuardProvider>,
    );

    // Initially loading
    expect(screen.getByText('Loading...')).toBeDefined();

    // Wait for resolution
    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeDefined();
    });
  });

  it('should show fallback if denied (async)', async () => {
    render(
      <AccessGuardProvider>
        <AccessGuard
          role="user" // Admin is actual role, so this fails
          fallback={<div>Forbidden</div>}
          loadingComponent={<div>Loading...</div>}
        >
          <div>Protected Content</div>
        </AccessGuard>
      </AccessGuardProvider>,
    );

    expect(screen.getByText('Loading...')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Forbidden')).toBeDefined();
    });
  });
});
