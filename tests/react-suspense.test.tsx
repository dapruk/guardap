// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
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

describe('React AccessGuard Suspense Support', () => {
  it('should suspend and show fallback from <Suspense>', async () => {
    render(
      <AccessGuardProvider>
        <Suspense fallback={<div>Global Loading...</div>}>
          <AccessGuard
            role="admin"
            suspense={true}
            fallback={<div>Forbidden</div>}
          >
            <div>Protected Content</div>
          </AccessGuard>
        </Suspense>
      </AccessGuardProvider>,
    );

    // Should show Suspense fallback initially
    expect(screen.getByText('Global Loading...')).toBeDefined();

    // Wait for resolution
    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeDefined();
    });
  });

  it('should show forbidden content after suspense resolves if denied', async () => {
    render(
      <AccessGuardProvider>
        <Suspense fallback={<div>Global Loading...</div>}>
          <AccessGuard
            role="user" // Fails
            suspense={true}
            fallback={<div>Forbidden</div>}
          >
            <div>Protected Content</div>
          </AccessGuard>
        </Suspense>
      </AccessGuardProvider>,
    );

    expect(screen.getByText('Global Loading...')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Forbidden')).toBeDefined();
    });
  });
});
